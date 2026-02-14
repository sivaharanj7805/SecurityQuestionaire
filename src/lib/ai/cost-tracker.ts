import { db } from "@/lib/db";
import { usageLogs } from "@/lib/db/schema";
import type { GenerateResult } from "./providers/types";

export async function trackUsage(
  orgId: string,
  result: GenerateResult
): Promise<void> {
  await db.insert(usageLogs).values({
    orgId,
    model: result.model,
    inputTokens: result.tokensUsed.input,
    outputTokens: result.tokensUsed.output,
    cachedTokens: (result.tokensUsed.cacheRead ?? 0) + (result.tokensUsed.cacheCreation ?? 0),
    estimatedCost: result.cost.toFixed(6),
  });
}
