/**
 * Rate limiting placeholder.
 *
 * TODO: Before launch, integrate Upstash Redis rate limiting (@upstash/ratelimit).
 * The previous in-memory rate limiter was removed because it does not work on
 * serverless platforms (each instance gets its own Map, making limits ineffective).
 *
 * For now, rate limiting is disabled. All callers have been updated to remove
 * rate-limit checks. When Upstash is integrated, re-add rate limiting to:
 *   - POST /api/upload (20 req/min per org)
 *   - POST /api/questionnaires/process (5 req/min per org)
 */
