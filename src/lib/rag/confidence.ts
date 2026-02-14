export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export interface ConfidenceAssessment {
  level: ConfidenceLevel;
  reason: string;
}

export function scoreConfidence(
  answer: string,
  topSimilarity: number
): ConfidenceAssessment {
  const isInsufficient =
    answer.includes("INSUFFICIENT_CONTEXT") ||
    answer.toLowerCase().includes("insufficient context");

  if (isInsufficient) {
    return {
      level: "none",
      reason: "Insufficient context in knowledge base to answer this question.",
    };
  }

  if (topSimilarity >= 0.7) {
    return {
      level: "high",
      reason: `Strong match found in knowledge base (similarity: ${(topSimilarity * 100).toFixed(0)}%).`,
    };
  }

  if (topSimilarity >= 0.5) {
    return {
      level: "medium",
      reason: `Moderate match found in knowledge base (similarity: ${(topSimilarity * 100).toFixed(0)}%). Review recommended.`,
    };
  }

  if (topSimilarity >= 0.3) {
    return {
      level: "low",
      reason: `Weak match found in knowledge base (similarity: ${(topSimilarity * 100).toFixed(0)}%). Manual verification strongly recommended.`,
    };
  }

  return {
    level: "none",
    reason: "No relevant context found in knowledge base.",
  };
}
