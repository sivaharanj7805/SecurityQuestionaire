import { db } from "@/lib/db";
import { chunks, documents } from "@/lib/db/schema";
import { eq, and, sql, gt } from "drizzle-orm";
import { generateEmbeddings } from "./embed";

export interface RetrievedChunk {
  chunkId: string;
  text: string;
  similarity: number;
  sourceDocName: string;
  metadata: Record<string, unknown> | null;
}

export async function retrieveContext(
  orgId: string,
  query: string,
  topK = 8,
  minSimilarity = 0.3
): Promise<RetrievedChunk[]> {
  // Embed the query
  const { embeddings } = await generateEmbeddings([query]);
  if (embeddings.length === 0) {
    return [];
  }

  const queryEmbedding = embeddings[0];
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  // Cosine similarity search with orgId filter
  const results = await db
    .select({
      chunkId: chunks.id,
      text: chunks.chunkText,
      similarity: sql<number>`1 - (${chunks.embedding} <=> ${embeddingStr}::vector)`,
      sourceDocName: documents.filename,
      metadata: chunks.metadata,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(
      and(
        eq(chunks.orgId, orgId),
        gt(
          sql`1 - (${chunks.embedding} <=> ${embeddingStr}::vector)`,
          minSimilarity
        )
      )
    )
    .orderBy(sql`${chunks.embedding} <=> ${embeddingStr}::vector`)
    .limit(topK);

  return results.map((row) => ({
    chunkId: row.chunkId,
    text: row.text,
    similarity: Number(row.similarity),
    sourceDocName: row.sourceDocName,
    metadata: row.metadata as Record<string, unknown> | null,
  }));
}

export async function retrieveFromAnswerLibrary(
  orgId: string,
  query: string,
  minSimilarity = 0.85
): Promise<{ questionPattern: string; approvedAnswer: string; similarity: number } | null> {
  const { embeddings } = await generateEmbeddings([query]);
  if (embeddings.length === 0) return null;

  const queryEmbedding = embeddings[0];
  const embeddingStr = `[${queryEmbedding.join(",")}]`;

  const { answerLibrary } = await import("@/lib/db/schema");

  const results = await db
    .select({
      questionPattern: answerLibrary.questionPattern,
      approvedAnswer: answerLibrary.approvedAnswer,
      similarity: sql<number>`1 - (${answerLibrary.embedding} <=> ${embeddingStr}::vector)`,
      id: answerLibrary.id,
      timesReused: answerLibrary.timesReused,
    })
    .from(answerLibrary)
    .where(
      and(
        eq(answerLibrary.orgId, orgId),
        gt(
          sql`1 - (${answerLibrary.embedding} <=> ${embeddingStr}::vector)`,
          minSimilarity
        )
      )
    )
    .orderBy(sql`${answerLibrary.embedding} <=> ${embeddingStr}::vector`)
    .limit(1);

  if (results.length === 0) return null;

  const match = results[0];

  // Increment reuse counter
  await db
    .update(answerLibrary)
    .set({
      timesReused: match.timesReused + 1,
      lastUsedAt: new Date(),
    })
    .where(eq(answerLibrary.id, match.id));

  return {
    questionPattern: match.questionPattern,
    approvedAnswer: match.approvedAnswer,
    similarity: Number(match.similarity),
  };
}
