import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { ingestDocument } from "@/lib/rag/ingest";

const ingestSchema = z.object({
  documentId: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();

    if (!orgId) {
      return NextResponse.json(
        { error: "Unauthorized. Please select an organization." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = ingestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const { documentId } = validation.data;

    const result = await ingestDocument(orgId, documentId);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("Ingestion error:", error);
    const message =
      error instanceof Error ? error.message : "Ingestion failed";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
