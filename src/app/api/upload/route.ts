import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { documents } from "@/lib/db/schema";
import { uploadFile } from "@/lib/storage/r2";
import { enforceLimit, PlanLimitError } from "@/lib/billing/enforce";
import { logAudit } from "@/lib/audit";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { resolveUserId } from "@/lib/users";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

// File magic bytes for validation
const MAGIC_BYTES: Record<string, number[]> = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  xlsx: [0x50, 0x4b, 0x03, 0x04], // PK (ZIP archive)
  docx: [0x50, 0x4b, 0x03, 0x04], // PK (ZIP archive)
};

function validateMagicBytes(buffer: Buffer, fileType: string): boolean {
  const expected = MAGIC_BYTES[fileType];
  if (!expected) return false;
  if (buffer.length < expected.length) return false;
  return expected.every((byte, i) => buffer[i] === byte);
}

function sanitizeFilename(filename: string): string {
  return filename
    .replace(/\.\./g, "") // Remove path traversal
    .replace(/[/\\]/g, "") // Remove slashes
    .replace(/\0/g, "") // Remove null bytes
    .replace(/[^a-zA-Z0-9._\-\s]/g, "_") // Replace special chars
    .slice(0, 255); // Enforce length limit
}

function hasDoubleExtension(filename: string): boolean {
  const parts = filename.split(".");
  if (parts.length <= 2) return false;
  const dangerousExts = ["exe", "bat", "cmd", "sh", "ps1", "vbs", "js", "msi"];
  // Check if any extension in a multi-extension file is dangerous
  return parts.slice(1).some((part) => dangerousExts.includes(part.toLowerCase()));
}

const uploadSchema = z.object({
  filename: z.string().min(1).max(255),
  fileType: z.string().refine((type) => type in ALLOWED_TYPES, {
    message: "File type not allowed. Only PDF, DOCX, and XLSX files are accepted.",
  }),
  fileSize: z
    .number()
    .min(1, { message: "File is empty." })
    .max(MAX_FILE_SIZE, {
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

    const rateLimit = await checkRateLimit("upload", orgId);
    if (rateLimit && !rateLimit.success) {
      return NextResponse.json(
        { error: "Too many uploads. Please wait before uploading more files." },
        { status: 429, headers: rateLimitHeaders(rateLimit) }
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

    // Enforce plan limits
    try {
      await enforceLimit(orgId, "pages");
    } catch (error) {
      if (error instanceof PlanLimitError) {
        return NextResponse.json(
          { error: error.message },
          { status: 403 }
        );
      }
      throw error;
    }

    // Sanitize filename
    const sanitizedFilename = sanitizeFilename(file.name);

    // Check for double extensions
    if (hasDoubleExtension(sanitizedFilename)) {
      return NextResponse.json(
        { error: "File has a suspicious double extension and was rejected." },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Validate magic bytes match the claimed file type
    const resolvedType = ALLOWED_TYPES[file.type];
    if (!validateMagicBytes(buffer, resolvedType)) {
      return NextResponse.json(
        { error: "File content does not match the expected file type." },
        { status: 400 }
      );
    }

    // Resolve Clerk userId to internal user UUID
    const internalUserId = await resolveUserId(userId);
    if (!internalUserId) {
      return NextResponse.json(
        { error: "User not found. Please complete onboarding first." },
        { status: 403 }
      );
    }

    const { fileKey, fileSize } = await uploadFile(orgId, buffer, {
      filename: sanitizedFilename,
      contentType: file.type,
    });

    const [document] = await db
      .insert(documents)
      .values({
        orgId,
        filename: sanitizedFilename,
        fileKey,
        fileType: resolvedType,
        fileSize,
        status: "processing",
        uploadedBy: internalUserId,
      })
      .returning();

    // Log audit
    await logAudit({
      orgId,
      userId: internalUserId,
      action: "document_uploaded",
      resourceType: "document",
      resourceId: document.id,
      details: { filename: sanitizedFilename, fileType: resolvedType, fileSize },
    });

    // Return document ID immediately. The frontend calls POST /api/ingest
    // with { documentId } to trigger ingestion as a separate request
    // (runs synchronously within the 60s serverless timeout).
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
