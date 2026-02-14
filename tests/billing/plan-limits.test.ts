import { describe, it, expect } from "vitest";
import { PLANS, getPlanDetails, formatLimit } from "@/lib/billing/plans";
import { PlanLimitError } from "@/lib/billing/enforce";

describe("Plan definitions", () => {
  it("defines all four plans", () => {
    expect(Object.keys(PLANS)).toEqual(["free", "starter", "growth", "scale"]);
  });

  it("free plan has correct limits", () => {
    const free = PLANS.free;
    expect(free.price).toBe(0);
    expect(free.limits.questionnaires).toBe(1);
    expect(free.limits.pages).toBe(10);
    expect(free.limits.seats).toBe(1);
    expect(free.stripePriceId).toBeNull();
  });

  it("starter plan has correct limits", () => {
    const starter = PLANS.starter;
    expect(starter.price).toBe(199);
    expect(starter.limits.questionnaires).toBe(5);
    expect(starter.limits.pages).toBe(50);
    expect(starter.limits.seats).toBe(2);
  });

  it("growth plan has unlimited pages", () => {
    const growth = PLANS.growth;
    expect(growth.price).toBe(499);
    expect(growth.limits.questionnaires).toBe(20);
    expect(growth.limits.pages).toBe(Infinity);
    expect(growth.limits.seats).toBe(5);
  });

  it("scale plan has unlimited questionnaires and pages", () => {
    const scale = PLANS.scale;
    expect(scale.price).toBe(799);
    expect(scale.limits.questionnaires).toBe(Infinity);
    expect(scale.limits.pages).toBe(Infinity);
    expect(scale.limits.seats).toBe(10);
  });

  it("plans are sorted by price ascending", () => {
    const prices = Object.values(PLANS).map((p) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });
});

describe("getPlanDetails", () => {
  it("returns correct plan by id", () => {
    expect(getPlanDetails("starter").name).toBe("Starter");
    expect(getPlanDetails("growth").name).toBe("Growth");
    expect(getPlanDetails("scale").name).toBe("Scale");
  });

  it("falls back to free plan for unknown id", () => {
    expect(getPlanDetails("invalid").id).toBe("free");
    expect(getPlanDetails("").id).toBe("free");
  });
});

describe("formatLimit", () => {
  it("formats Infinity as Unlimited", () => {
    expect(formatLimit(Infinity)).toBe("Unlimited");
  });

  it("formats numbers as strings", () => {
    expect(formatLimit(5)).toBe("5");
    expect(formatLimit(50)).toBe("50");
    expect(formatLimit(0)).toBe("0");
  });
});

describe("PlanLimitError", () => {
  it("creates error with correct message", () => {
    const error = new PlanLimitError("questionnaires", 5, 5, "Starter");
    expect(error.message).toContain("questionnaires");
    expect(error.message).toContain("5/5");
    expect(error.message).toContain("Starter");
    expect(error.message).toContain("upgrade");
    expect(error.name).toBe("PlanLimitError");
  });

  it("formats unlimited limits in message", () => {
    const error = new PlanLimitError("pages", 100, Infinity, "Scale");
    expect(error.message).toContain("Unlimited");
  });

  it("stores metadata on the error", () => {
    const error = new PlanLimitError("seats", 2, 2, "Starter");
    expect(error.resource).toBe("seats");
    expect(error.current).toBe(2);
    expect(error.limit).toBe(2);
    expect(error.planName).toBe("Starter");
  });

  it("is an instance of Error", () => {
    const error = new PlanLimitError("questionnaires", 1, 1, "Free");
    expect(error).toBeInstanceOf(Error);
  });
});
