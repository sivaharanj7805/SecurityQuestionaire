import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  _redis = new Redis({ url, token });
  return _redis;
}

type RateLimitTier = "upload" | "process" | "ingest" | "regenerate";

const LIMITS: Record<RateLimitTier, { requests: number; window: string }> = {
  upload: { requests: 20, window: "1 m" },
  process: { requests: 5, window: "1 m" },
  ingest: { requests: 20, window: "1 m" },
  regenerate: { requests: 10, window: "1 m" },
};

const _limiters = new Map<RateLimitTier, Ratelimit>();

function getLimiter(tier: RateLimitTier): Ratelimit | null {
  const redis = getRedis();
  if (!redis) return null;

  let limiter = _limiters.get(tier);
  if (limiter) return limiter;

  const config = LIMITS[tier];
  limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(config.requests, config.window as Parameters<typeof Ratelimit.slidingWindow>[1]),
    prefix: `ratelimit:${tier}`,
    analytics: true,
  });

  _limiters.set(tier, limiter);
  return limiter;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

/**
 * Check rate limit for a given tier and identifier (typically orgId).
 * Returns null if rate limiting is not configured (missing env vars),
 * allowing graceful degradation in development.
 */
export async function checkRateLimit(
  tier: RateLimitTier,
  identifier: string
): Promise<RateLimitResult | null> {
  const limiter = getLimiter(tier);
  if (!limiter) return null;

  const result = await limiter.limit(identifier);

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

/**
 * Build rate limit response headers from a rate limit result.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  };
}
