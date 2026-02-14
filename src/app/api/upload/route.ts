import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { uploadFile } from "@/lib/storage/r2";
import { ingestDocument } from "@/lib/rag/ingest";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

const uploadSchema = z.object({
  filename: z.string().min(1),
  fileType: z.string().refine((type) => type in ALLOWED_TYPES, {
    message: "File type not allowed. Only PDF, DOCX, and XLSX files are accepted.",
  }),
  fileSize: z.number().max(MAX_FILE_SIZE, {
    message: `File size exceeds the maximum limit of ${MAX_FILE_SIZE / 1024 / 1024}MB.`,
  }),
});

export async function POST(request: NextRequest) {
  try {
    const { userId, orgId } = await auth();

    if (!userId || !orgId) {
      return NextResponse.json(
        { error: "Unauthorized. Please sign in and select an organization." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided." },
        { status: 400 }
      );
    }

    const validation = uploadSchema.safeParse({
      filename: file.name,
      fileType: file.type,
      fileSize: file.size,
    });

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const { fileKey, fileSize } = await uploadFile(orgId, buffer, {
      filename: file.name,
      contentType: file.type,
    });

    const [document] = await db
      .insert(documents)
      .values({
        orgId,
        filename: file.name,
        fileKey,
        fileType: ALLOWED_TYPES[file.type],
        fileSize,
        status: "processing",
        uploadedBy: userId,
      })
      .returning();

    // Fire-and-forget ingestion — don't block the upload response
    ingestDocument(orgId, document.id).catch((err) => {
      console.error(`Background ingestion failed for ${document.id}:`, err);
    });

    return NextResponse.json({
      id: document.id,
      filename: document.filename,
      status: document.status,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during upload. Please try again." },
      { status: 500 }
    );
  }
}
