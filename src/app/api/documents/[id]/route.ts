import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { documents, chunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { deleteFile } from "@/lib/storage/r2";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.orgId, orgId)));

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error("Error fetching document:", error);
    return NextResponse.json(
      { error: "Failed to fetch document." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const [document] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), eq(documents.orgId, orgId)));

    if (!document) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Delete chunks first
    await db
      .delete(chunks)
      .where(and(eq(chunks.documentId, id), eq(chunks.orgId, orgId)));

    // Delete document record
    await db
      .delete(documents)
      .where(and(eq(documents.id, id), eq(documents.orgId, orgId)));

    // Delete file from R2
    await deleteFile(orgId, document.fileKey);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document." },
      { status: 500 }
    );
  }
}
