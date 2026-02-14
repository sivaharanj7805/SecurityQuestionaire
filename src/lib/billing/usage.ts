import { db } from "@/lib/db";
import { documents, questionnaires, users, organizations } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { getPlanDetails } from "./plans";

export interface UsageData {
  questionnaires: number;
  pages: number;
  seats: number;
}

export async function getCurrentUsage(orgId: string): Promise<UsageData> {
  const [questionnaireCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(questionnaires)
    .where(eq(questionnaires.orgId, orgId));

  const [pageCount] = await db
    .select({ total: sql<number>`coalesce(sum(page_count), 0)::int` })
    .from(documents)
    .where(eq(documents.orgId, orgId));

  const [seatCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(users)
    .where(eq(users.orgId, orgId));

  return {
    questionnaires: questionnaireCount.count,
    pages: pageCount.total,
    seats: seatCount.count,
  };
}

export type ResourceType = "questionnaires" | "pages" | "seats";

export interface LimitCheckResult {
  allowed: boolean;
  current: number;
  limit: number;
  resource: ResourceType;
  planName: string;
}

export async function checkLimit(
  clerkOrgId: string,
  resource: ResourceType
): Promise<LimitCheckResult> {
  // Get org's internal ID and plan
  const [org] = await db
    .select({
      id: organizations.id,
      plan: organizations.plan,
    })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, clerkOrgId));

  if (!org) {
    return {
      allowed: false,
      current: 0,
      limit: 0,
      resource,
      planName: "Unknown",
    };
  }

  const planDetails = getPlanDetails(org.plan);
  const usage = await getCurrentUsage(org.id);

  const current = usage[resource];
  const limit = planDetails.limits[resource];

  return {
    allowed: current < limit,
    current,
    limit,
    resource,
    planName: planDetails.name,
  };
}
