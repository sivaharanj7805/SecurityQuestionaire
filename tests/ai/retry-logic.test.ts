import { describe, it, expect } from "vitest";

// Test the retry-related logic from the Anthropic provider

class MockAPIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof MockAPIError) {
    return error.status === 429 || error.status >= 500;
  }
  if (error instanceof Error && error.message.includes("fetch")) {
    return true;
  }
  return false;
}

describe("Anthropic retry logic", () => {
  it("retries on rate limit (429)", () => {
    const error = new MockAPIError(429, "Rate limited");
    expect(isRetryableError(error)).toBe(true);
  });

  it("retries on server error (500)", () => {
    const error = new MockAPIError(500, "Internal server error");
    expect(isRetryableError(error)).toBe(true);
  });

  it("retries on overloaded (529)", () => {
    const error = new MockAPIError(529, "Overloaded");
    expect(isRetryableError(error)).toBe(true);
  });

  it("retries on network/fetch errors", () => {
    const error = new Error("fetch failed: connection refused");
    expect(isRetryableError(error)).toBe(true);
  });

  it("does NOT retry on auth error (401)", () => {
    const error = new MockAPIError(401, "Unauthorized");
    expect(isRetryableError(error)).toBe(false);
  });

  it("does NOT retry on bad request (400)", () => {
    const error = new MockAPIError(400, "Bad request");
    expect(isRetryableError(error)).toBe(false);
  });

  it("does NOT retry on generic non-fetch errors", () => {
    const error = new Error("Something went wrong");
    expect(isRetryableError(error)).toBe(false);
  });

  it("does NOT retry on non-Error objects", () => {
    expect(isRetryableError("string error")).toBe(false);
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError(undefined)).toBe(false);
  });
});

describe("Exponential backoff calculation", () => {
  const BASE_DELAY_MS = 1000;

  it("calculates correct delays", () => {
    expect(BASE_DELAY_MS * Math.pow(2, 0)).toBe(1000); // attempt 1
    expect(BASE_DELAY_MS * Math.pow(2, 1)).toBe(2000); // attempt 2
    expect(BASE_DELAY_MS * Math.pow(2, 2)).toBe(4000); // attempt 3
  });
});
