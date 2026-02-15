"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { documents, chunks } from "@/lib/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { deleteFile } from "@/lib/storage/r2";

export async function getDocuments() {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  return db
    .select()
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.createdAt));
}

export async function getDocument(documentId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));

  return document ?? null;
}

export async function getDocumentChunks(
  documentId: string,
  page: number = 1,
  pageSize: number = 20
) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  const offset = (page - 1) * pageSize;

  const [chunkList, totalResult] = await Promise.all([
    db
      .select({
        id: chunks.id,
        chunkText: chunks.chunkText,
        chunkIndex: chunks.chunkIndex,
        metadata: chunks.metadata,
        createdAt: chunks.createdAt,
      })
      .from(chunks)
      .where(
        and(
          eq(chunks.documentId, documentId),
          eq(chunks.orgId, orgId)
        )
      )
      .orderBy(chunks.chunkIndex)
      .limit(pageSize)
      .offset(offset),
    db
      .select({ count: count() })
      .from(chunks)
      .where(
        and(
          eq(chunks.documentId, documentId),
          eq(chunks.orgId, orgId)
        )
      ),
  ]);

  return {
    chunks: chunkList,
    total: totalResult[0].count,
    page,
    pageSize,
    totalPages: Math.ceil(totalResult[0].count / pageSize),
  };
}

export async function deleteDocument(documentId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  const [document] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));

  if (!document) {
    throw new Error("Document not found");
  }

  // Delete chunks + document in a transaction
  await db.transaction(async (tx) => {
    await tx
      .delete(chunks)
      .where(
        and(eq(chunks.documentId, documentId), eq(chunks.orgId, orgId))
      );

    await tx
      .delete(documents)
      .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));
  });

  // Delete from R2 after DB transaction commits (best-effort cleanup)
  await deleteFile(orgId, document.fileKey);

  return { success: true };
}

export async function getDocumentStats() {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  const [docStats] = await db
    .select({
      totalDocuments: count(),
      totalPages: sql<number>`coalesce(sum(${documents.pageCount}), 0)`,
    })
    .from(documents)
    .where(eq(documents.orgId, orgId));

  const [chunkStats] = await db
    .select({ totalChunks: count() })
    .from(chunks)
    .where(eq(chunks.orgId, orgId));

  return {
    totalDocuments: docStats.totalDocuments,
    totalPages: Number(docStats.totalPages),
    totalChunks: chunkStats.totalChunks,
  };
}
