import { describe, it, expect } from "vitest";
import { scoreConfidence } from "@/lib/rag/confidence";

describe("scoreConfidence", () => {
  it("returns HIGH for similarity > 0.7", () => {
    const result = scoreConfidence("A valid answer.", 0.85);
    expect(result.level).toBe("high");
    expect(result.reason).toContain("Strong match");
  });

  it("returns HIGH for similarity exactly 0.7", () => {
    const result = scoreConfidence("A valid answer.", 0.7);
    expect(result.level).toBe("high");
  });

  it("returns MEDIUM for similarity 0.5-0.7", () => {
    const result = scoreConfidence("Some answer.", 0.6);
    expect(result.level).toBe("medium");
    expect(result.reason).toContain("Moderate match");
  });

  it("returns LOW for similarity 0.3-0.5", () => {
    const result = scoreConfidence("Weak answer.", 0.35);
    expect(result.level).toBe("low");
    expect(result.reason).toContain("Weak match");
  });

  it("returns NONE for similarity below 0.3", () => {
    const result = scoreConfidence("No match answer.", 0.1);
    expect(result.level).toBe("none");
  });

  it("returns NONE for INSUFFICIENT_CONTEXT in answer", () => {
    const result = scoreConfidence(
      "INSUFFICIENT_CONTEXT: No information found.",
      0.9
    );
    expect(result.level).toBe("none");
    expect(result.reason).toContain("Insufficient context");
  });

  it("returns NONE for case-insensitive insufficient context", () => {
    const result = scoreConfidence(
      "The answer has insufficient context to determine this.",
      0.8
    );
    expect(result.level).toBe("none");
  });

  it("includes similarity percentage in reason", () => {
    const result = scoreConfidence("An answer.", 0.75);
    expect(result.reason).toContain("75%");
  });
});
