import { describe, it, expect } from "vitest";
import { z } from "zod";

// Replicate the validation schemas from the codebase to test them

const VALID_QUESTION_STATUSES = ["draft", "approved", "rejected", "skipped"] as const;
const VALID_CONFIDENCE_LEVELS = ["high", "medium", "low", "none"] as const;

const singleUpdateSchema = z.object({
  questionId: z.string().uuid(),
  humanAnswer: z.string().max(10000).optional(),
  status: z.enum(VALID_QUESTION_STATUSES).optional(),
  aiAnswer: z.string().max(10000).optional(),
  confidence: z.enum(VALID_CONFIDENCE_LEVELS).optional(),
});

const bulkUpdateSchema = z.object({
  questionIds: z.array(z.string().uuid()).min(1).max(500),
  status: z.enum(VALID_QUESTION_STATUSES),
});

const addLibrarySchema = z.object({
  questionPattern: z.string().min(1).max(5000),
  approvedAnswer: z.string().min(1).max(10000),
  sourceDocIds: z.array(z.string().uuid()).optional(),
});

const updateLibrarySchema = z.object({
  entryId: z.string().uuid(),
  questionPattern: z.string().min(1).max(5000).optional(),
  approvedAnswer: z.string().min(1).max(10000).optional(),
});

const billingActionSchema = z.object({
  action: z.enum(["checkout", "portal"]),
  priceId: z.string().min(1).optional(),
});

describe("Question update validation", () => {
  it("accepts valid single question update", () => {
    const result = singleUpdateSchema.safeParse({
      questionId: "550e8400-e29b-41d4-a716-446655440000",
      humanAnswer: "Yes, we comply.",
      status: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid question status", () => {
    const result = singleUpdateSchema.safeParse({
      questionId: "550e8400-e29b-41d4-a716-446655440000",
      status: "invalid_status",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid confidence level", () => {
    const result = singleUpdateSchema.safeParse({
      questionId: "550e8400-e29b-41d4-a716-446655440000",
      confidence: "super_high",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID questionId", () => {
    const result = singleUpdateSchema.safeParse({
      questionId: "not-a-uuid",
      status: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects answers exceeding max length", () => {
    const result = singleUpdateSchema.safeParse({
      questionId: "550e8400-e29b-41d4-a716-446655440000",
      humanAnswer: "x".repeat(10001),
    });
    expect(result.success).toBe(false);
  });
});

describe("Bulk question update validation", () => {
  it("accepts valid bulk update", () => {
    const result = bulkUpdateSchema.safeParse({
      questionIds: ["550e8400-e29b-41d4-a716-446655440000"],
      status: "approved",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty questionIds array", () => {
    const result = bulkUpdateSchema.safeParse({
      questionIds: [],
      status: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects more than 500 questionIds", () => {
    const ids = Array.from({ length: 501 }, (_, i) =>
      `550e8400-e29b-41d4-a716-${String(i).padStart(12, "0")}`
    );
    const result = bulkUpdateSchema.safeParse({
      questionIds: ids,
      status: "approved",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid status in bulk update", () => {
    const result = bulkUpdateSchema.safeParse({
      questionIds: ["550e8400-e29b-41d4-a716-446655440000"],
      status: "completed",
    });
    expect(result.success).toBe(false);
  });
});

describe("Answer library validation", () => {
  it("accepts valid library entry", () => {
    const result = addLibrarySchema.safeParse({
      questionPattern: "Do you have a SOC 2 report?",
      approvedAnswer: "Yes, we maintain SOC 2 Type II compliance.",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty questionPattern", () => {
    const result = addLibrarySchema.safeParse({
      questionPattern: "",
      approvedAnswer: "Some answer",
    });
    expect(result.success).toBe(false);
  });

  it("rejects questionPattern exceeding max length", () => {
    const result = addLibrarySchema.safeParse({
      questionPattern: "q".repeat(5001),
      approvedAnswer: "Some answer",
    });
    expect(result.success).toBe(false);
  });

  it("validates sourceDocIds as UUIDs", () => {
    const result = addLibrarySchema.safeParse({
      questionPattern: "Question?",
      approvedAnswer: "Answer.",
      sourceDocIds: ["not-a-uuid"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid update", () => {
    const result = updateLibrarySchema.safeParse({
      entryId: "550e8400-e29b-41d4-a716-446655440000",
      questionPattern: "Updated question?",
    });
    expect(result.success).toBe(true);
  });
});

describe("Billing action validation", () => {
  it("accepts valid checkout action", () => {
    const result = billingActionSchema.safeParse({
      action: "checkout",
      priceId: "price_abc123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid portal action", () => {
    const result = billingActionSchema.safeParse({
      action: "portal",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid action", () => {
    const result = billingActionSchema.safeParse({
      action: "refund",
    });
    expect(result.success).toBe(false);
  });
});
