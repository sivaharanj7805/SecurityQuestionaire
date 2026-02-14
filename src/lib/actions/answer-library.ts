"use server";

import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { answerLibrary } from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { generateEmbeddings } from "@/lib/rag/embed";

export async function addToLibrary(data: {
  questionPattern: string;
  approvedAnswer: string;
  sourceDocIds?: string[];
}) {
  const { userId, orgId } = await auth();
  if (!userId || !orgId) throw new Error("Unauthorized");

  const { embeddings } = await generateEmbeddings([data.questionPattern]);
  const embedding = embeddings[0] ?? null;

  const [entry] = await db
    .insert(answerLibrary)
    .values({
      orgId,
      questionPattern: data.questionPattern,
      approvedAnswer: data.approvedAnswer,
      sourceDocIds: data.sourceDocIds ?? null,
      embedding,
      createdBy: userId,
    })
    .returning();

  return entry;
}

export async function getLibraryEntries() {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  return db
    .select({
      id: answerLibrary.id,
      questionPattern: answerLibrary.questionPattern,
      approvedAnswer: answerLibrary.approvedAnswer,
      timesReused: answerLibrary.timesReused,
      lastUsedAt: answerLibrary.lastUsedAt,
      createdAt: answerLibrary.createdAt,
    })
    .from(answerLibrary)
    .where(eq(answerLibrary.orgId, orgId))
    .orderBy(desc(answerLibrary.createdAt));
}

export async function updateLibraryEntry(
  entryId: string,
  data: { questionPattern?: string; approvedAnswer?: string }
) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  const updates: Record<string, unknown> = {};
  if (data.questionPattern !== undefined) {
    updates.questionPattern = data.questionPattern;
    const { embeddings } = await generateEmbeddings([data.questionPattern]);
    updates.embedding = embeddings[0] ?? null;
  }
  if (data.approvedAnswer !== undefined) {
    updates.approvedAnswer = data.approvedAnswer;
  }

  await db
    .update(answerLibrary)
    .set(updates)
    .where(and(eq(answerLibrary.id, entryId), eq(answerLibrary.orgId, orgId)));

  return { success: true };
}

export async function deleteLibraryEntry(entryId: string) {
  const { orgId } = await auth();
  if (!orgId) throw new Error("No organization selected");

  await db
    .delete(answerLibrary)
    .where(and(eq(answerLibrary.id, entryId), eq(answerLibrary.orgId, orgId)));

  return { success: true };
}
