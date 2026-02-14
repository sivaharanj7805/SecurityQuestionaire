import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import {
  getOrCreateCustomer,
  createCheckoutSession,
  createBillingPortalSession,
  getSubscription,
} from "@/lib/billing/stripe";
import { getCurrentUsage } from "@/lib/billing/usage";
import { getPlanDetails, PLANS } from "@/lib/billing/plans";

const billingActionSchema = z.object({
  action: z.enum(["checkout", "portal"]),
  priceId: z.string().min(1).optional(),
});

export async function GET() {
  try {
    const { orgId } = await auth();
    if (!orgId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, orgId));

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const planDetails = getPlanDetails(org.plan);
    const usage = await getCurrentUsage(org.id);

    let subscription = null;
    if (org.stripeCustomerId) {
      try {
        subscription = await getSubscription(org.stripeCustomerId);
      } catch {
        // Stripe might not be configured
      }
    }

    // Stripe SDK v20+ uses camelCase; access safely
    const subData = subscription as Record<string, unknown> | null;

    return NextResponse.json({
      plan: planDetails,
      usage,
      subscription: subData
        ? {
            status: subData.status,
            currentPeriodEnd:
              subData.currentPeriodEnd ?? subData.current_period_end,
            cancelAtPeriodEnd:
              subData.cancelAtPeriodEnd ?? subData.cancel_at_period_end,
          }
        : null,
      plans: Object.values(PLANS),
    });
  } catch (error) {
    console.error("Error fetching billing:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing info" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await auth();
    const user = await currentUser();
    if (!orgId || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const validation = billingActionSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      );
    }
    const { action, priceId } = validation.data;

    const [org] = await db
      .select()
      .from(organizations)
      .where(eq(organizations.clerkOrgId, orgId));

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const email = user.emailAddresses[0]?.emailAddress ?? "";
    const customerId = await getOrCreateCustomer(orgId, org.name, email);

    if (action === "checkout") {
      if (!priceId) {
        return NextResponse.json(
          { error: "priceId is required for checkout" },
          { status: 400 }
        );
      }
      const url = await createCheckoutSession(customerId, priceId, orgId);
      return NextResponse.json({ url });
    }

    if (action === "portal") {
      const url = await createBillingPortalSession(customerId);
      return NextResponse.json({ url });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Error in billing action:", error);
    return NextResponse.json(
      { error: "Billing action failed" },
      { status: 500 }
    );
  }
}
