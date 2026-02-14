import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit";

describe("Rate limiting", () => {
  // Use unique keys per test to avoid cross-test contamination
  let testKey: string;
  beforeEach(() => {
    testKey = `test:${Date.now()}:${Math.random()}`;
  });

  it("allows requests within the limit", () => {
    const result = rateLimit(testKey, { maxRequests: 5, windowMs: 60_000 });
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.limit).toBe(5);
  });

  it("blocks requests exceeding the limit", () => {
    for (let i = 0; i < 3; i++) {
      rateLimit(testKey, { maxRequests: 3, windowMs: 60_000 });
    }
    const result = rateLimit(testKey, { maxRequests: 3, windowMs: 60_000 });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks remaining count correctly", () => {
    const r1 = rateLimit(testKey, { maxRequests: 5, windowMs: 60_000 });
    expect(r1.remaining).toBe(4);
    const r2 = rateLimit(testKey, { maxRequests: 5, windowMs: 60_000 });
    expect(r2.remaining).toBe(3);
    const r3 = rateLimit(testKey, { maxRequests: 5, windowMs: 60_000 });
    expect(r3.remaining).toBe(2);
  });

  it("isolates different keys", () => {
    const keyA = `${testKey}:a`;
    const keyB = `${testKey}:b`;

    for (let i = 0; i < 3; i++) {
      rateLimit(keyA, { maxRequests: 3, windowMs: 60_000 });
    }

    // Key A should be exhausted
    expect(rateLimit(keyA, { maxRequests: 3, windowMs: 60_000 }).success).toBe(false);
    // Key B should still have capacity
    expect(rateLimit(keyB, { maxRequests: 3, windowMs: 60_000 }).success).toBe(true);
  });

  it("returns rate limit headers", () => {
    const result = rateLimit(testKey, { maxRequests: 10, windowMs: 60_000 });
    const headers = rateLimitHeaders(result);
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("9");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
  });

  it("uses default parameters when none provided", () => {
    const result = rateLimit(testKey);
    expect(result.success).toBe(true);
    expect(result.limit).toBe(60); // default maxRequests
  });

  it("resets after window expires", () => {
    // Use a 1ms window so it expires immediately
    for (let i = 0; i < 2; i++) {
      rateLimit(testKey, { maxRequests: 2, windowMs: 1 });
    }

    // Small delay to let the window expire
    const start = Date.now();
    while (Date.now() - start < 5) {
      // busy wait 5ms
    }

    const result = rateLimit(testKey, { maxRequests: 2, windowMs: 1 });
    expect(result.success).toBe(true);
  });
});
