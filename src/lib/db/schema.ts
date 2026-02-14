import {
  pgTable,
  uuid,
  text,
  pgEnum,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
  vector,
  numeric,
} from "drizzle-orm/pg-core";

// Enums
export const planEnum = pgEnum("plan", [
  "free",
  "starter",
  "growth",
  "scale",
]);

export const userRoleEnum = pgEnum("user_role", [
  "owner",
  "admin",
  "member",
]);

export const documentStatusEnum = pgEnum("document_status", [
  "processing",
  "ready",
  "failed",
]);

export const questionnaireStatusEnum = pgEnum("questionnaire_status", [
  "processing",
  "draft",
  "in_review",
  "completed",
  "exported",
]);

export const answerFormatEnum = pgEnum("answer_format", [
  "freetext",
  "yes_no",
  "multiple_choice",
]);

export const confidenceEnum = pgEnum("confidence", [
  "high",
  "medium",
  "low",
  "none",
]);

export const questionStatusEnum = pgEnum("question_status", [
  "draft",
  "approved",
  "rejected",
  "skipped",
]);

// Tables
export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  clerkOrgId: text("clerk_org_id").unique().notNull(),
  stripeCustomerId: text("stripe_customer_id"),
  plan: planEnum("plan").default("free").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
});

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    email: text("email").notNull(),
    clerkUserId: text("clerk_user_id").unique().notNull(),
    role: userRoleEnum("role").default("member").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("users_org_id_idx").on(table.orgId),
    index("users_clerk_user_id_idx").on(table.clerkUserId),
    uniqueIndex("users_org_email_idx").on(table.orgId, table.email),
  ]
);

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    filename: text("filename").notNull(),
    fileKey: text("file_key").notNull(),
    fileType: text("file_type").notNull(),
    fileSize: integer("file_size").notNull(),
    status: documentStatusEnum("status").default("processing").notNull(),
    pageCount: integer("page_count"),
    chunkCount: integer("chunk_count").default(0).notNull(),
    errorMessage: text("error_message"),
    uploadedBy: uuid("uploaded_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("documents_org_id_idx").on(table.orgId),
    index("documents_org_status_idx").on(table.orgId, table.status),
    index("documents_org_created_idx").on(table.orgId, table.createdAt),
  ]
);

export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    documentId: uuid("document_id")
      .references(() => documents.id)
      .notNull(),
    chunkText: text("chunk_text").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    metadata: jsonb("metadata"),
    chunkIndex: integer("chunk_index").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("chunks_org_id_idx").on(table.orgId),
    index("chunks_document_id_idx").on(table.documentId),
    index("chunks_org_document_idx").on(table.orgId, table.documentId),
    index("chunks_embedding_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

export const questionnaires = pgTable(
  "questionnaires",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    name: text("name").notNull(),
    sourceFileKey: text("source_file_key"),
    status: questionnaireStatusEnum("status").default("processing").notNull(),
    questionCount: integer("question_count"),
    completedCount: integer("completed_count").default(0).notNull(),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("questionnaires_org_id_idx").on(table.orgId),
    index("questionnaires_org_status_idx").on(table.orgId, table.status),
    index("questionnaires_org_created_idx").on(table.orgId, table.createdAt),
  ]
);

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    questionnaireId: uuid("questionnaire_id")
      .references(() => questionnaires.id)
      .notNull(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    section: text("section"),
    questionText: text("question_text").notNull(),
    answerFormat: answerFormatEnum("answer_format")
      .default("freetext")
      .notNull(),
    aiAnswer: text("ai_answer"),
    humanAnswer: text("human_answer"),
    confidence: confidenceEnum("confidence").default("none").notNull(),
    status: questionStatusEnum("status").default("draft").notNull(),
    sourceChunkIds: jsonb("source_chunk_ids"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("questions_org_id_idx").on(table.orgId),
    index("questions_questionnaire_id_idx").on(table.questionnaireId),
    index("questions_questionnaire_status_idx").on(table.questionnaireId, table.status),
  ]
);

export const answerLibrary = pgTable(
  "answer_library",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    questionPattern: text("question_pattern").notNull(),
    approvedAnswer: text("approved_answer").notNull(),
    sourceDocIds: jsonb("source_doc_ids"),
    embedding: vector("embedding", { dimensions: 1536 }),
    timesReused: integer("times_reused").default(0).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "date" }),
    createdBy: uuid("created_by")
      .references(() => users.id)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("answer_library_org_id_idx").on(table.orgId),
    index("answer_library_embedding_idx")
      .using("hnsw", table.embedding.op("vector_cosine_ops")),
  ]
);

export const usageLogs = pgTable(
  "usage_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    model: text("model").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cachedTokens: integer("cached_tokens").default(0).notNull(),
    estimatedCost: numeric("estimated_cost", { precision: 10, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("usage_logs_org_id_idx").on(table.orgId),
    index("usage_logs_org_created_idx").on(table.orgId, table.createdAt),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    userId: uuid("user_id"),
    action: text("action").notNull(),
    resourceType: text("resource_type").notNull(),
    resourceId: uuid("resource_id"),
    details: jsonb("details"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).defaultNow().notNull(),
  },
  (table) => [
    index("audit_logs_org_id_idx").on(table.orgId),
    index("audit_logs_org_created_idx").on(table.orgId, table.createdAt),
    index("audit_logs_org_action_idx").on(table.orgId, table.action),
  ]
);
