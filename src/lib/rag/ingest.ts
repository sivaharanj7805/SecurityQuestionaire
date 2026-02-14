import { db } from "@/lib/db";
import { documents, chunks } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { downloadFile } from "@/lib/storage/r2";
import { parseDocument } from "@/lib/parsers";
import { chunkDocument } from "./chunk";
import { generateEmbeddings } from "./embed";

interface IngestResult {
  chunksCreated: number;
  tokensUsed: number;
  durationMs: number;
}

async function streamToBuffer(
  stream: ReadableStream
): Promise<Buffer> {
  const reader = stream.getReader();
  const parts: Uint8Array[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
  }

  return Buffer.concat(parts);
}

export async function ingestDocument(
  orgId: string,
  documentId: string
): Promise<IngestResult> {
  const startTime = Date.now();

  try {
    // 1. Fetch document record
    const [doc] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));

    if (!doc) {
      throw new Error("Document not found");
    }

    // 2. Download file from R2
    const fileStream = await downloadFile(orgId, doc.fileKey);
    if (!fileStream) {
      throw new Error("Failed to download file from storage");
    }

    const buffer = await streamToBuffer(fileStream);

    // 3. Parse document
    const parsed = await parseDocument(buffer, doc.fileType);

    // 4. Chunk document
    const docChunks = chunkDocument(parsed, documentId);

    if (docChunks.length === 0) {
      // Mark as ready even with no chunks — document had no parseable content
      await db
        .update(documents)
        .set({
          status: "ready",
          pageCount: parsed.metadata.pageCount ?? null,
        })
        .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));

      return {
        chunksCreated: 0,
        tokensUsed: 0,
        durationMs: Date.now() - startTime,
      };
    }

    // 5. Generate embeddings
    const chunkTexts = docChunks.map((c) => c.text);
    const { embeddings, tokensUsed } = await generateEmbeddings(chunkTexts);

    // 6. Delete any existing chunks for this document (re-processing case)
    await db
      .delete(chunks)
      .where(
        and(eq(chunks.documentId, documentId), eq(chunks.orgId, orgId))
      );

    // 7. Insert chunks into DB
    const chunkValues = docChunks.map((chunk, index) => ({
      orgId,
      documentId,
      chunkText: chunk.text,
      embedding: embeddings[index],
      metadata: chunk.metadata,
      chunkIndex: chunk.metadata.chunkIndex,
    }));

    // Insert in batches of 50 to avoid oversized queries
    const BATCH_SIZE = 50;
    for (let i = 0; i < chunkValues.length; i += BATCH_SIZE) {
      const batch = chunkValues.slice(i, i + BATCH_SIZE);
      await db.insert(chunks).values(batch);
    }

    // 8. Update document status to ready with chunk count
    await db
      .update(documents)
      .set({
        status: "ready",
        pageCount: parsed.metadata.pageCount ?? null,
        chunkCount: docChunks.length,
      })
      .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));

    return {
      chunksCreated: docChunks.length,
      tokensUsed,
      durationMs: Date.now() - startTime,
    };
  } catch (error) {
    // Mark document as failed
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error during ingestion";

    console.error(`Ingestion failed for document ${documentId}:`, errorMessage);

    await db
      .update(documents)
      .set({
        status: "failed",
        errorMessage: errorMessage,
      })
      .where(and(eq(documents.id, documentId), eq(documents.orgId, orgId)));

    throw error;
  }
}
