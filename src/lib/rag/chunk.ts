import type { ParsedDocument } from "@/lib/parsers";

export interface Chunk {
  text: string;
  metadata: {
    sourceDocId: string;
    section: string;
    chunkIndex: number;
    pageNumber?: number;
  };
  estimatedTokens: number;
}

interface ChunkOptions {
  maxTokens?: number;
  overlapTokens?: number;
  minChunkChars?: number;
}

const DEFAULT_MAX_TOKENS = 800;
const DEFAULT_OVERLAP_TOKENS = 100;
const DEFAULT_MIN_CHUNK_CHARS = 50;

// Rough token estimate: ~4 chars per token for English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function splitIntoSentences(text: string): string[] {
  // Split on sentence boundaries, keeping the delimiter
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((s) => s.trim().length > 0);
}

function chunkSection(
  sentences: string[],
  maxTokens: number,
  overlapTokens: number
): string[] {
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentTokens = 0;

  for (const sentence of sentences) {
    const sentenceTokens = estimateTokens(sentence);

    // If a single sentence exceeds maxTokens, add it as its own chunk
    if (sentenceTokens > maxTokens) {
      if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
        currentChunk = [];
        currentTokens = 0;
      }
      chunks.push(sentence);
      continue;
    }

    if (currentTokens + sentenceTokens > maxTokens && currentChunk.length > 0) {
      chunks.push(currentChunk.join(" "));

      // Build overlap: walk backwards from end of currentChunk
      const overlapSentences: string[] = [];
      let overlapCount = 0;
      for (let i = currentChunk.length - 1; i >= 0; i--) {
        const tokens = estimateTokens(currentChunk[i]);
        if (overlapCount + tokens > overlapTokens) break;
        overlapSentences.unshift(currentChunk[i]);
        overlapCount += tokens;
      }

      currentChunk = [...overlapSentences];
      currentTokens = overlapCount;
    }

    currentChunk.push(sentence);
    currentTokens += sentenceTokens;
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(" "));
  }

  return chunks;
}

export function chunkDocument(
  parsed: ParsedDocument,
  sourceDocId: string,
  opts: ChunkOptions = {}
): Chunk[] {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const overlapTokens = opts.overlapTokens ?? DEFAULT_OVERLAP_TOKENS;
  const minChunkChars = opts.minChunkChars ?? DEFAULT_MIN_CHUNK_CHARS;

  const allChunks: Chunk[] = [];
  let globalIndex = 0;

  for (const section of parsed.sections) {
    const text = section.content.trim();
    if (text.length < minChunkChars) continue;

    const sentences = splitIntoSentences(text);
    const sectionChunks = chunkSection(sentences, maxTokens, overlapTokens);

    // Detect page number from heading like "Page 3"
    const pageMatch = section.heading.match(/^Page\s+(\d+)$/i);
    const pageNumber = pageMatch ? parseInt(pageMatch[1], 10) : undefined;

    for (const chunkText of sectionChunks) {
      if (chunkText.trim().length < minChunkChars) continue;

      allChunks.push({
        text: chunkText.trim(),
        metadata: {
          sourceDocId,
          section: section.heading,
          chunkIndex: globalIndex,
          pageNumber,
        },
        estimatedTokens: estimateTokens(chunkText),
      });

      globalIndex++;
    }
  }

  // If no sections produced chunks, try chunking the raw text
  if (allChunks.length === 0 && parsed.rawText.trim().length >= minChunkChars) {
    const sentences = splitIntoSentences(parsed.rawText);
    const rawChunks = chunkSection(sentences, maxTokens, overlapTokens);

    for (const chunkText of rawChunks) {
      if (chunkText.trim().length < minChunkChars) continue;

      allChunks.push({
        text: chunkText.trim(),
        metadata: {
          sourceDocId,
          section: "",
          chunkIndex: globalIndex,
        },
        estimatedTokens: estimateTokens(chunkText),
      });

      globalIndex++;
    }
  }

  return allChunks;
}
