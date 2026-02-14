import { auth } from "@clerk/nextjs/server";

export async function getCurrentUser() {
  const { userId, orgId, orgSlug } = await auth();

  if (!userId) {
    throw new Error("Not authenticated");
  }

  return {
    userId,
    orgId: orgId ?? null,
    orgName: orgSlug ?? null,
  };
}
