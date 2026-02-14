import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

const userIdCache = new Map<string, { internalId: string; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Resolve a Clerk userId (e.g. "user_xxx") to the internal users.id UUID.
 * Uses an in-memory cache with 5-minute TTL to avoid repeated DB lookups.
 * Returns null if the user is not found in the database.
 */
export async function resolveUserId(clerkUserId: string): Promise<string | null> {
  const cached = userIdCache.get(clerkUserId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.internalId;
  }

  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));

  if (!user) return null;

  userIdCache.set(clerkUserId, {
    internalId: user.id,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return user.id;
}
