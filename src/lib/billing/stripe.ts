import Stripe from "stripe";
import { db } from "@/lib/db";
import { organizations } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

let _stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: "2026-01-28.clover",
    });
  }
  return _stripe;
}

export async function createCustomer(
  orgId: string,
  orgName: string,
  email: string
): Promise<string> {
  const stripe = getStripe();

  const customer = await stripe.customers.create({
    name: orgName,
    email,
    metadata: { orgId },
  });

  // Store customer ID in org
  await db
    .update(organizations)
    .set({ stripeCustomerId: customer.id })
    .where(eq(organizations.clerkOrgId, orgId));

  return customer.id;
}

export async function getOrCreateCustomer(
  orgId: string,
  orgName: string,
  email: string
): Promise<string> {
  const [org] = await db
    .select({ stripeCustomerId: organizations.stripeCustomerId })
    .from(organizations)
    .where(eq(organizations.clerkOrgId, orgId));

  if (org?.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  return createCustomer(orgId, orgName, email);
}

export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  orgId: string
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=billing&success=true`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=billing&canceled=true`,
    metadata: { orgId },
  });

  return session.url!;
}

export async function createBillingPortalSession(
  customerId: string
): Promise<string> {
  const stripe = getStripe();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings?tab=billing`,
  });

  return session.url;
}

export async function getSubscription(
  customerId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripe();

  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    status: "active",
    limit: 1,
  });

  return subscriptions.data[0] ?? null;
}

export function getStripeInstance(): Stripe {
  return getStripe();
}
