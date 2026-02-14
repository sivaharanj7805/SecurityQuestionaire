import { checkLimit, type ResourceType } from "./usage";
import { formatLimit } from "./plans";

export class PlanLimitError extends Error {
  public resource: ResourceType;
  public current: number;
  public limit: number;
  public planName: string;

  constructor(
    resource: ResourceType,
    current: number,
    limit: number,
    planName: string
  ) {
    const limitStr = formatLimit(limit);
    super(
      `You've reached the ${resource} limit (${current}/${limitStr}) on your ${planName} plan. Please upgrade to continue.`
    );
    this.name = "PlanLimitError";
    this.resource = resource;
    this.current = current;
    this.limit = limit;
    this.planName = planName;
  }
}

export async function enforceLimit(
  clerkOrgId: string,
  resource: ResourceType
): Promise<void> {
  const result = await checkLimit(clerkOrgId, resource);

  if (!result.allowed) {
    throw new PlanLimitError(
      result.resource,
      result.current,
      result.limit,
      result.planName
    );
  }
}
