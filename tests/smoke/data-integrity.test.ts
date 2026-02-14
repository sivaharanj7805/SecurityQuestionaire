import { describe, it, expect } from "vitest";
import { scoreConfidence } from "@/lib/rag/confidence";
import { sanitizeForAI, truncateForEmbedding } from "@/lib/ai/sanitize";
import { formatLimit, getPlanDetails, PLANS } from "@/lib/billing/plans";
import { generateExcelExport } from "@/lib/export/excel-export";

describe("Data integrity: confidence scoring", () => {
  it("HIGH for similarity >= 0.7", () => {
    expect(scoreConfidence("Answer text", 0.75).level).toBe("high");
    expect(scoreConfidence("Answer text", 0.7).level).toBe("high");
    expect(scoreConfidence("Answer text", 1.0).level).toBe("high");
  });

  it("MEDIUM for similarity 0.5-0.69", () => {
    expect(scoreConfidence("Answer text", 0.6).level).toBe("medium");
    expect(scoreConfidence("Answer text", 0.5).level).toBe("medium");
  });

  it("LOW for similarity 0.3-0.49", () => {
    expect(scoreConfidence("Answer text", 0.4).level).toBe("low");
    expect(scoreConfidence("Answer text", 0.3).level).toBe("low");
  });

  it("NONE for similarity < 0.3", () => {
    expect(scoreConfidence("Answer text", 0.2).level).toBe("none");
    expect(scoreConfidence("Answer text", 0.0).level).toBe("none");
  });

  it("NONE for INSUFFICIENT_CONTEXT regardless of similarity", () => {
    expect(scoreConfidence("INSUFFICIENT_CONTEXT: missing info", 0.9).level).toBe("none");
  });
});

describe("Data integrity: plan limits", () => {
  it("all four plans exist", () => {
    expect(Object.keys(PLANS)).toEqual(["free", "starter", "growth", "scale"]);
  });

  it("free plan has strictest limits", () => {
    const free = getPlanDetails("free");
    expect(free.limits.questionnaires).toBe(1);
    expect(free.limits.pages).toBe(10);
    expect(free.limits.seats).toBe(1);
  });

  it("scale plan has unlimited questionnaires and pages", () => {
    const scale = getPlanDetails("scale");
    expect(scale.limits.questionnaires).toBe(Infinity);
    expect(scale.limits.pages).toBe(Infinity);
  });

  it("plans increase monotonically", () => {
    const free = getPlanDetails("free");
    const starter = getPlanDetails("starter");
    const growth = getPlanDetails("growth");
    const scale = getPlanDetails("scale");
    expect(starter.limits.questionnaires).toBeGreaterThan(free.limits.questionnaires);
    expect(growth.limits.questionnaires).toBeGreaterThan(starter.limits.questionnaires);
    expect(scale.limits.questionnaires).toBeGreaterThanOrEqual(growth.limits.questionnaires);
  });

  it("unknown plan falls back to free", () => {
    const unknown = getPlanDetails("nonexistent");
    expect(unknown.id).toBe("free");
  });

  it("formatLimit shows 'Unlimited' for Infinity", () => {
    expect(formatLimit(Infinity)).toBe("Unlimited");
    expect(formatLimit(5)).toBe("5");
  });
});

describe("Data integrity: export correctness", () => {
  it("approved questions use humanAnswer when available", () => {
    // This tests the export logic pattern used in the route
    const question = {
      humanAnswer: "Human edited answer",
      aiAnswer: "AI generated answer",
      status: "approved" as const,
    };
    const answer = question.humanAnswer ?? question.aiAnswer ?? "";
    expect(answer).toBe("Human edited answer");
  });

  it("approved questions fall back to aiAnswer when humanAnswer is null", () => {
    const question = {
      humanAnswer: null as string | null,
      aiAnswer: "AI generated answer",
      status: "approved" as const,
    };
    const answer = question.humanAnswer ?? question.aiAnswer ?? "";
    expect(answer).toBe("AI generated answer");
  });

  it("skipped questions should show N/A", () => {
    const question = {
      humanAnswer: null as string | null,
      aiAnswer: "Some answer",
      status: "skipped" as const,
    };
    const answer = question.status === "skipped" ? "N/A" : (question.humanAnswer ?? question.aiAnswer ?? "");
    expect(answer).toBe("N/A");
  });
});

describe("Data integrity: sanitization pipeline", () => {
  it("sanitization does not corrupt legitimate security question text", () => {
    const questions = [
      "Do you have SOC 2 Type II certification?",
      "Describe your incident response process.",
      "What is your data retention policy?",
      "Do you encrypt data at rest and in transit?",
      "How do you handle access control?",
      "Do you perform regular penetration testing?",
      "What is your disaster recovery RTO/RPO?",
      "Is multi-factor authentication required?",
    ];
    for (const q of questions) {
      expect(sanitizeForAI(q)).toBe(q);
    }
  });

  it("truncation preserves text within limits", () => {
    const text = "Do you have SOC 2?";
    expect(truncateForEmbedding(text, 8000)).toBe(text);
  });
});

describe("Data integrity: export generates valid files", () => {
  it("excel export for 200+ questions completes", () => {
    const questions = Array.from({ length: 250 }, (_, i) => ({
      section: `Section ${Math.floor(i / 25) + 1}`,
      questionText: `Question ${i + 1}: Do you have controls for scenario ${i + 1}?`,
      answer: `Yes, we implement controls for scenario ${i + 1} as documented in our security policy.`,
      confidence: i % 3 === 0 ? "high" : i % 3 === 1 ? "medium" : "low",
      status: "approved",
    }));
    const buffer = generateExcelExport("Large Questionnaire", questions);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
