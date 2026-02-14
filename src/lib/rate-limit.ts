/**
 * Simple in-memory sliding-window rate limiter.
 *
 * Note: On serverless platforms like Vercel, each invocation may use a
 * separate instance, so this provides per-instance protection only.
 * For production-grade rate limiting, use an external store (Redis/Upstash).
 */

interface RateLimitEntry {
  timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Clean up stale entries every 60 seconds
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function ensureCleanup(windowMs: number) {
  if (cleanupInterval) return;
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);
      if (entry.timestamps.length === 0) {
        store.delete(key);
      }
    }
  }, 60_000);
  // Don't prevent process exit
  if (cleanupInterval && typeof cleanupInterval === "object" && "unref" in cleanupInterval) {
    cleanupInterval.unref();
  }
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

export function rateLimit(
  key: string,
  {
    maxRequests = 60,
    windowMs = 60_000,
  }: { maxRequests?: number; windowMs?: number } = {}
): RateLimitResult {
  ensureCleanup(windowMs);

  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < windowMs);

  if (entry.timestamps.length >= maxRequests) {
    const oldestInWindow = entry.timestamps[0];
    const resetMs = oldestInWindow + windowMs - now;
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  entry.timestamps.push(now);

  return {
    success: true,
    limit: maxRequests,
    remaining: maxRequests - entry.timestamps.length,
    resetMs: windowMs,
  };
}

/**
 * Helper to create a rate-limited NextResponse when limit is exceeded.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.ceil(result.resetMs / 1000)),
  };
}
