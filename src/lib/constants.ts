export const APP_NAME = "SecureQuest";

export const PLAN_LIMITS = {
  free: {
    documents: 5,
    questionnaires: 2,
    questionsPerMonth: 50,
    teamMembers: 1,
  },
  starter: {
    documents: 50,
    questionnaires: 10,
    questionsPerMonth: 500,
    teamMembers: 3,
    priceMonthly: 199,
  },
  growth: {
    documents: 200,
    questionnaires: 50,
    questionsPerMonth: 2000,
    teamMembers: 10,
    priceMonthly: 499,
  },
  scale: {
    documents: -1, // unlimited
    questionnaires: -1,
    questionsPerMonth: -1,
    teamMembers: -1,
    priceMonthly: 799,
  },
} as const;

export type PlanName = keyof typeof PLAN_LIMITS;
