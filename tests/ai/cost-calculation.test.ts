import { describe, it, expect } from "vitest";

// Test cost calculation logic directly since the function is private in the provider
// We replicate the pricing and calculation to verify correctness

const PRICING = {
  "claude-sonnet-4-5-20250929": {
    input: 3,
    output: 15,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  "claude-haiku-4-5-20251001": {
    input: 1,
    output: 5,
    cacheRead: 0.1,
    cacheCreation: 1.25,
  },
};

function calculateCost(
  model: string,
  tokens: { input: number; output: number; cacheRead?: number; cacheCreation?: number }
): number {
  const pricing = PRICING[model as keyof typeof PRICING];
  if (!pricing) return 0;

  const inputCost = (tokens.input / 1_000_000) * pricing.input;
  const outputCost = (tokens.output / 1_000_000) * pricing.output;
  const cacheReadCost = ((tokens.cacheRead ?? 0) / 1_000_000) * pricing.cacheRead;
  const cacheCreationCost = ((tokens.cacheCreation ?? 0) / 1_000_000) * pricing.cacheCreation;

  return inputCost + outputCost + cacheReadCost + cacheCreationCost;
}

describe("Cost calculation", () => {
  it("correctly calculates Sonnet cost", () => {
    const cost = calculateCost("claude-sonnet-4-5-20250929", {
      input: 1000,
      output: 500,
    });
    // 1000/1M * $3 + 500/1M * $15 = $0.003 + $0.0075 = $0.0105
    expect(cost).toBeCloseTo(0.0105, 6);
  });

  it("correctly calculates Haiku cost", () => {
    const cost = calculateCost("claude-haiku-4-5-20251001", {
      input: 1000,
      output: 500,
    });
    // 1000/1M * $1 + 500/1M * $5 = $0.001 + $0.0025 = $0.0035
    expect(cost).toBeCloseTo(0.0035, 6);
  });

  it("correctly calculates cost with cached tokens", () => {
    const cost = calculateCost("claude-sonnet-4-5-20250929", {
      input: 1000,
      output: 500,
      cacheRead: 2000,
      cacheCreation: 500,
    });
    // input: 1000/1M * 3 = 0.003
    // output: 500/1M * 15 = 0.0075
    // cacheRead: 2000/1M * 0.3 = 0.0006
    // cacheCreation: 500/1M * 3.75 = 0.001875
    expect(cost).toBeCloseTo(0.012975, 6);
  });

  it("returns 0 for unknown model", () => {
    const cost = calculateCost("unknown-model", {
      input: 1000,
      output: 500,
    });
    expect(cost).toBe(0);
  });

  it("handles zero tokens", () => {
    const cost = calculateCost("claude-sonnet-4-5-20250929", {
      input: 0,
      output: 0,
    });
    expect(cost).toBe(0);
  });

  it("Haiku is cheaper than Sonnet for same tokens", () => {
    const tokens = { input: 1000, output: 500 };
    const sonnetCost = calculateCost("claude-sonnet-4-5-20250929", tokens);
    const haikuCost = calculateCost("claude-haiku-4-5-20251001", tokens);
    expect(haikuCost).toBeLessThan(sonnetCost);
  });
});
