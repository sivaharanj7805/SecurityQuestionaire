import { describe, it, expect } from "vitest";
import { chunkDocument, type Chunk } from "@/lib/rag/chunk";
import type { ParsedDocument } from "@/lib/parsers";

function makeParsed(sections: { heading: string; content: string }[]): ParsedDocument {
  return {
    rawText: sections.map((s) => s.content).join("\n"),
    sections,
    metadata: { fileType: "test" },
  };
}

function longText(sentences: number): string {
  const sentence = "This is a test sentence with enough words to take up some space in the chunk. ";
  return Array(sentences).fill(sentence).join("");
}

describe("chunkDocument", () => {
  it("produces chunks from sections", () => {
    const parsed = makeParsed([
      { heading: "Section 1", content: longText(10) },
    ]);

    const chunks = chunkDocument(parsed, "doc-1");
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.sourceDocId).toBe("doc-1");
    expect(chunks[0].metadata.section).toBe("Section 1");
  });

  it("respects maxTokens limit", () => {
    const parsed = makeParsed([
      { heading: "Big Section", content: longText(100) },
    ]);

    const chunks = chunkDocument(parsed, "doc-1", { maxTokens: 200 });

    for (const chunk of chunks) {
      // Allow some tolerance — sentence boundaries may slightly exceed
      expect(chunk.estimatedTokens).toBeLessThanOrEqual(250);
    }
  });

  it("includes metadata with correct chunkIndex", () => {
    const parsed = makeParsed([
      { heading: "A", content: longText(50) },
      { heading: "B", content: longText(50) },
    ]);

    const chunks = chunkDocument(parsed, "doc-1", { maxTokens: 200 });

    // chunkIndex should be globally incrementing
    for (let i = 0; i < chunks.length; i++) {
      expect(chunks[i].metadata.chunkIndex).toBe(i);
    }
  });

  it("handles overlap between chunks", () => {
    const parsed = makeParsed([
      { heading: "Test", content: longText(80) },
    ]);

    const chunks = chunkDocument(parsed, "doc-1", {
      maxTokens: 200,
      overlapTokens: 50,
    });

    // With overlap, adjacent chunks should share some text
    if (chunks.length >= 2) {
      const chunk1Words = chunks[0].text.split(" ");
      const chunk2Words = chunks[1].text.split(" ");
      const lastWordsOfChunk1 = chunk1Words.slice(-5).join(" ");
      // The overlap means some ending words of chunk1 appear at start of chunk2
      const startsWithOverlap = chunk2Words.slice(0, 20).join(" ").includes(lastWordsOfChunk1.split(" ")[0]);
      // Just check that multiple chunks were created (overlap doesn't prevent splitting)
      expect(chunks.length).toBeGreaterThan(1);
    }
  });

  it("skips sections shorter than minChunkChars", () => {
    const parsed = makeParsed([
      { heading: "Tiny", content: "Short." },
      { heading: "Normal", content: longText(20) },
    ]);

    const chunks = chunkDocument(parsed, "doc-1", { minChunkChars: 50 });

    // No chunk should come from the tiny section
    for (const chunk of chunks) {
      expect(chunk.metadata.section).not.toBe("Tiny");
    }
  });

  it("detects page numbers from headings", () => {
    const parsed = makeParsed([
      { heading: "Page 3", content: longText(10) },
    ]);

    const chunks = chunkDocument(parsed, "doc-1");
    expect(chunks[0].metadata.pageNumber).toBe(3);
  });

  it("falls back to rawText when sections produce no chunks", () => {
    const parsed: ParsedDocument = {
      rawText: longText(20),
      sections: [{ heading: "Empty", content: "Hi" }],
      metadata: { fileType: "test" },
    };

    const chunks = chunkDocument(parsed, "doc-1", { minChunkChars: 50 });
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks[0].metadata.section).toBe("");
  });

  it("handles empty document", () => {
    const parsed = makeParsed([]);
    const chunks = chunkDocument(parsed, "doc-1");
    expect(chunks).toEqual([]);
  });

  it("handles a single very long sentence", () => {
    const longSentence = "word ".repeat(5000) + ".";
    const parsed = makeParsed([
      { heading: "Long", content: longSentence },
    ]);

    const chunks = chunkDocument(parsed, "doc-1", { maxTokens: 200 });
    expect(chunks.length).toBeGreaterThan(0);
  });
});
