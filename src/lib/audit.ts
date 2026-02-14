import { db } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { lt } from "drizzle-orm";

export type AuditAction =
  | "document_uploaded"
  | "document_deleted"
  | "document_ingested"
  | "document_ingestion_failed"
  | "questionnaire_created"
  | "questionnaire_processed"
  | "questionnaire_deleted"
  | "questionnaire_exported"
  | "question_approved"
  | "question_rejected"
  | "question_skipped"
  | "question_bulk_approved"
  | "answer_library_added"
  | "answer_library_updated"
  | "answer_library_deleted"
  | "plan_changed";

export type ResourceType =
  | "document"
  | "questionnaire"
  | "question"
  | "answer_library"
  | "organization";

export async function logAudit(params: {
  orgId: string;
  userId?: string | null;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditLogs).values({
      orgId: params.orgId,
      userId: params.userId ?? null,
      action: params.action,
      resourceType: params.resourceType,
      resourceId: params.resourceId ?? null,
      details: params.details ?? null,
    });
  } catch (error) {
    // Audit logging should never crash the main operation
    console.error("Failed to write audit log:", error);
  }
}

const DEFAULT_RETENTION_DAYS = 90;

/**
 * Delete audit log entries older than the specified retention period.
 * Call this from a scheduled job (e.g. Vercel cron, external scheduler).
 * Returns the number of deleted rows.
 */
export async function cleanupAuditLogs(
  retentionDays: number = DEFAULT_RETENTION_DAYS
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const result = await db
    .delete(auditLogs)
    .where(lt(auditLogs.createdAt, cutoff));

  return result.count;
}
