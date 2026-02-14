export interface PlanLimit {
  questionnaires: number;
  pages: number;
  seats: number;
}

export interface PlanDetails {
  id: "free" | "starter" | "growth" | "scale";
  name: string;
  price: number;
  limits: PlanLimit;
  stripePriceId: string | null;
}

export const PLANS: Record<string, PlanDetails> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    limits: {
      questionnaires: 1,
      pages: 10,
      seats: 1,
    },
    stripePriceId: null,
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 199,
    limits: {
      questionnaires: 5,
      pages: 50,
      seats: 2,
    },
    stripePriceId: process.env.STRIPE_PRICE_STARTER ?? null,
  },
  growth: {
    id: "growth",
    name: "Growth",
    price: 499,
    limits: {
      questionnaires: 20,
      pages: Infinity,
      seats: 5,
    },
    stripePriceId: process.env.STRIPE_PRICE_GROWTH ?? null,
  },
  scale: {
    id: "scale",
    name: "Scale",
    price: 799,
    limits: {
      questionnaires: Infinity,
      pages: Infinity,
      seats: 10,
    },
    stripePriceId: process.env.STRIPE_PRICE_SCALE ?? null,
  },
};

export function getPlanDetails(planId: string): PlanDetails {
  return PLANS[planId] ?? PLANS.free;
}

export function formatLimit(value: number): string {
  return value === Infinity ? "Unlimited" : String(value);
}
