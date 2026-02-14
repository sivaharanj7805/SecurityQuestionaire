import { NextRequest, NextResponse } from "next/server";
import { getStripeInstance } from "@/lib/billing/stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";

const PLAN_PRICE_MAP: Record<string, "starter" | "growth" | "scale"> = {};

function buildPriceMap() {
  if (process.env.STRIPE_PRICE_STARTER) {
    PLAN_PRICE_MAP[process.env.STRIPE_PRICE_STARTER] = "starter";
  }
  if (process.env.STRIPE_PRICE_GROWTH) {
    PLAN_PRICE_MAP[process.env.STRIPE_PRICE_GROWTH] = "growth";
  }
  if (process.env.STRIPE_PRICE_SCALE) {
    PLAN_PRICE_MAP[process.env.STRIPE_PRICE_SCALE] = "scale";
  }
}

function getPlanFromPriceId(priceId: string): "starter" | "growth" | "scale" | null {
  buildPriceMap();
  return PLAN_PRICE_MAP[priceId] ?? null;
}

async function updateOrgPlan(
  customerId: string,
  plan: "free" | "starter" | "growth" | "scale"
) {
  await db
    .update(organizations)
    .set({ plan })
    .where(eq(organizations.stripeCustomerId, customerId));
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json(
      { error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  const stripe = getStripeInstance();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook verification failed:", err);
    return NextResponse.json(
      { error: "Invalid signature" },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );
          const priceId = subscription.items.data[0]?.price.id;
          if (priceId && session.customer) {
            const plan = getPlanFromPriceId(priceId);
            if (plan) {
              await updateOrgPlan(session.customer as string, plan);
            }
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const priceId = subscription.items.data[0]?.price.id;
        if (priceId && subscription.customer) {
          const plan = getPlanFromPriceId(priceId);
          if (plan && subscription.status === "active") {
            await updateOrgPlan(subscription.customer as string, plan);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        if (subscription.customer) {
          await updateOrgPlan(subscription.customer as string, "free");
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.warn(
          `Payment failed for customer ${invoice.customer}. Invoice: ${invoice.id}`
        );
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Return 200 even on handler errors to prevent Stripe from retrying non-transient failures
    console.error("Stripe webhook handler error:", error);
    return NextResponse.json({ received: true });
  }
}
