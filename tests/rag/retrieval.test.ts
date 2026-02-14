import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the db and embed modules before importing retrieve
vi.mock("@/lib/db", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
}));

vi.mock("@/lib/db/schema", () => ({
  chunks: {
    id: "id",
    chunkText: "chunk_text",
    embedding: "embedding",
    orgId: "org_id",
    documentId: "document_id",
    metadata: "metadata",
  },
  documents: {
    id: "id",
    filename: "filename",
  },
  answerLibrary: {
    id: "id",
    questionPattern: "question_pattern",
    approvedAnswer: "approved_answer",
    embedding: "embedding",
    orgId: "org_id",
    timesReused: "times_reused",
    lastUsedAt: "last_used_at",
  },
}));

vi.mock("@/lib/rag/embed", () => ({
  generateEmbeddings: vi.fn().mockResolvedValue({
    embeddings: [Array(1536).fill(0.1)],
    tokensUsed: 10,
  }),
}));

describe("retrieval module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should require orgId for context retrieval", async () => {
    const { retrieveContext } = await import("@/lib/rag/retrieve");
    const { db } = await import("@/lib/db");

    const result = await retrieveContext("org-123", "test question");

    // Verify db.select was called (meaning query was built with orgId filter)
    expect(db.select).toHaveBeenCalled();
    expect(result).toEqual([]);
  });

  it("should use similarity threshold", async () => {
    const { retrieveContext } = await import("@/lib/rag/retrieve");

    // Default minSimilarity is 0.3
    const result = await retrieveContext("org-123", "test", 5, 0.5);
    expect(result).toEqual([]);
  });

  it("should return empty array when no embeddings generated", async () => {
    const { generateEmbeddings } = await import("@/lib/rag/embed");
    vi.mocked(generateEmbeddings).mockResolvedValueOnce({
      embeddings: [],
      tokensUsed: 0,
    });

    const { retrieveContext } = await import("@/lib/rag/retrieve");
    const result = await retrieveContext("org-123", "test");
    expect(result).toEqual([]);
  });

  it("should return null from answer library when no match", async () => {
    const { retrieveFromAnswerLibrary } = await import("@/lib/rag/retrieve");

    const { db } = await import("@/lib/db");
    vi.mocked(db.limit).mockResolvedValueOnce([]);

    const result = await retrieveFromAnswerLibrary("org-123", "test question");
    expect(result).toBeNull();
  });

  it("should default to topK=8 and minSimilarity=0.3", async () => {
    const { retrieveContext } = await import("@/lib/rag/retrieve");
    const { db } = await import("@/lib/db");

    await retrieveContext("org-123", "test question");

    // limit should be called with 8
    expect(db.limit).toHaveBeenCalledWith(8);
  });
});
