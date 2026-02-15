# Security & Code Audit Report

**Repository:** SecurityQuestionaire (SecureQuest)
**Date:** 2026-02-14
**Auditor:** Automated Code Audit (Claude Opus 4.6)
**Files Reviewed:** 104 (every file in the repository)
**Verdict:** The codebase is structurally sound but has several critical gaps that must be addressed before production deployment at scale.

---

## Executive Summary

This is a competent early-stage SaaS product with a well-organized Next.js 15 architecture, proper multi-tenant data isolation, solid input validation with Zod, and a functional RAG pipeline. The developer clearly understands security fundamentals: there's org-scoped database filtering on every tenant query, Stripe webhook signature verification, file magic-byte validation, prompt injection sanitization, and audit logging. However, the codebase has **critical production readiness gaps**: the rate limiter is in-memory (useless on serverless), environment validation is defined but never called, the upload dropzone has a stale closure bug that corrupts progress tracking, fire-and-forget background work will be killed on serverless platforms, bulk question updates execute N+1 individual queries, there are no database transactions around multi-step destructive operations, and the regenerate feature sends parameters the API doesn't accept. For a $10M deal, these issues range from embarrassing (broken upload progress) to dangerous (no real rate limiting, no transactions on delete cascades). Fix the 8 critical items below and this codebase is deployable.

**Overall Rating: 6.5/10** - Good architecture, good security posture, incomplete production hardening.

---

## File-by-File Audit

### Root / Config Files

#### `package.json`
**Purpose:** Project dependencies and scripts.
**Issues:**
- None significant. Dependencies are current and well-chosen. No known vulnerable packages.
**Recommended action:** None.

#### `tsconfig.json`
**Purpose:** TypeScript compiler configuration.
**Issues:**
- None. Standard Next.js config with proper `@/` alias.
**Recommended action:** None.

#### `drizzle.config.ts`
**Purpose:** Drizzle ORM migration configuration.
**Issues:**
- None. Points to schema correctly, uses DATABASE_URL.
**Recommended action:** None.

#### `eslint.config.mjs`
**Purpose:** ESLint configuration.
**Issues:**
- None. Uses `next/core-web-vitals` and `next/typescript`.
**Recommended action:** None.

#### `next.config.ts`
**Purpose:** Next.js configuration.
**Issues:**
- Line 3: `serverExternalPackages: ["pdf-parse"]` is necessary due to pdf-parse's Node.js requirements. Fine.
- Line 5: `maxDuration: 60` for serverless functions. Adequate for document processing.
**Recommended action:** None.

#### `vercel.json`
**Purpose:** Vercel deployment configuration.
**Issues:**
- Sets `maxDuration: 60` globally for API routes. Adequate.
**Recommended action:** None.

#### `vitest.config.ts`
**Purpose:** Test runner configuration.
**Issues:**
- None. Properly resolves `@/` alias for tests.
**Recommended action:** None.

#### `.gitignore`
**Purpose:** Git exclusion rules.
**Issues:**
- Correctly excludes `.env*` files (preventing secret leakage).
**Recommended action:** None.

#### `.env.example`
**Purpose:** Documents required environment variables.
**Issues:**
- None. Complete list of required vars. Good documentation.
**Recommended action:** None.

#### `components.json`
**Purpose:** shadcn/ui component configuration.
**Issues:**
- None. Standard config.
**Recommended action:** None.

#### `CLAUDE.md`
**Purpose:** Development instructions for Claude Code agent.
**Issues:**
- None. Clear and accurate.
**Recommended action:** None.

#### `README.md`
**Purpose:** Project documentation.
**Issues:**
- None significant.
**Recommended action:** None.

---

### Core Library Files (`src/lib/`)

#### `src/lib/env.ts`
**Purpose:** Zod-based environment variable validation with secret exposure check.
**Issues:**
- **[CRITICAL, Line 39-62]** `validateEnv()` is exported but **never imported or called anywhere** in the codebase. The entire environment validation system is dead code. The application will start with missing env vars and crash with cryptic runtime errors instead of a clear startup validation failure.
- Line 54: The `NEXT_PUBLIC_` secret detection is a good defense-in-depth measure, but it's also never executed.
**Recommended action:** Import and call `validateEnv()` in the root layout or a server-side instrumentation hook.

#### `src/lib/auth.ts`
**Purpose:** Wrapper around Clerk's `auth()` for extracting user context.
**Issues:**
- **[MEDIUM, Line 10-11]** `getCurrentUser()` returns `orgId: orgId ?? null` but this function is not actually used by API routes. API routes call `auth()` directly, which is fine. This file is effectively dead code.
**Recommended action:** Either use this consistently or delete it.

#### `src/lib/db/index.ts`
**Purpose:** Drizzle PostgreSQL client initialization.
**Issues:**
- None. Standard singleton pattern.
**Recommended action:** None.

#### `src/lib/db/schema.ts`
**Purpose:** Full database schema definition.
**Issues:**
- None critical. Well-structured schema with proper indexes, orgId on every tenant table, vector columns with HNSW indexes, and appropriate foreign key references.
- **[LOW]** `uploadedBy` on `documents` (line 108) and `createdBy` on `questionnaires` (line 157) reference `users.id` which is an internal UUID, but API routes receive Clerk user IDs (strings like `user_xxx`). This means these columns likely store Clerk IDs rather than internal UUIDs, which would violate the foreign key constraint. Need to verify the mapping logic.
**Recommended action:** Verify that user ID mapping (Clerk ID -> internal UUID) happens before inserting into these tables.

#### `src/lib/utils.ts`
**Purpose:** `cn()` utility for className merging.
**Issues:**
- None. Standard shadcn/ui pattern.
**Recommended action:** None.

#### `src/lib/constants.ts`
**Purpose:** Application-wide constants.
**Issues:**
- **[LOW]** Constants are well-centralized here but not consistently used. `MAX_FILE_SIZE` is redefined in `upload/route.ts:12` and `upload-dropzone.tsx:16` instead of importing from here.
**Recommended action:** Import constants from this file to avoid drift.

#### `src/lib/audit.ts`
**Purpose:** Audit logging to database.
**Issues:**
- Line 47: Silently catches audit write failures. Appropriate - audit logging should never crash the main operation.
- **[LOW]** No audit log rotation or cleanup strategy. Table will grow unbounded.
**Recommended action:** Add a cron or scheduled cleanup for old audit entries.

#### `src/lib/rate-limit.ts`
**Purpose:** In-memory sliding-window rate limiter.
**Issues:**
- **[CRITICAL, Line 13]** Uses an in-memory `Map` store. On Vercel/serverless, each function invocation may be a fresh instance. Rate limiting is effectively non-functional in production. The comment on line 6 acknowledges this but offers no mitigation.
- Line 20-28: The cleanup `setInterval` with `unref()` is a nice touch for local development but irrelevant in serverless.
**Recommended action:** Replace with Redis/Upstash-based rate limiter for production. This is essential for protecting the AI processing endpoints from abuse.

#### `src/middleware.ts`
**Purpose:** Clerk authentication middleware.
**Issues:**
- None. Correctly protects `/dashboard(.*)` routes while leaving public routes (marketing, auth, API webhooks) accessible.
- **[NOTE]** The middleware matcher (line 12-15) correctly excludes static assets. API routes are matched by the `/(api|trpc)(.*)` pattern and individually check auth.
**Recommended action:** None.

---

### Billing (`src/lib/billing/`)

#### `src/lib/billing/plans.ts`
**Purpose:** Plan tier definitions with limits.
**Issues:**
- None. Clean constants-based plan definition. Scale plan uses `Infinity` for unlimited resources, which is handled by `formatLimit()`.
**Recommended action:** None.

#### `src/lib/billing/stripe.ts`
**Purpose:** Stripe client and helper functions.
**Issues:**
- **[LOW]** Uses lazy initialization with `getStripeInstance()`. Fine for serverless.
**Recommended action:** None.

#### `src/lib/billing/enforce.ts`
**Purpose:** Plan limit enforcement.
**Issues:**
- None. Clean separation. `PlanLimitError` carries structured data for good error messages.
**Recommended action:** None.

#### `src/lib/billing/usage.ts`
**Purpose:** Usage counting (questionnaires, pages, seats).
**Issues:**
- **[LOW, Line 13-26]** Three parallel DB queries per limit check. Efficient with `Promise.all` but could be a single query.
- **[LOW, Line 71]** Uses `current < limit` (strict less-than). If a user has exactly hit their limit, they're blocked. This is correct behavior but should be documented.
**Recommended action:** None required.

---

### AI (`src/lib/ai/`)

#### `src/lib/ai/providers/anthropic.ts`
**Purpose:** Anthropic Claude API client with retry logic.
**Issues:**
- **[LOW, Line 100]** `as unknown as Record<string, number>` type assertion to access cache token fields. Fragile if SDK types change.
- Retry logic (lines 46-58, 70-126) is well-implemented: exponential backoff, retries on 429/5xx/network errors, max 3 attempts.
**Recommended action:** None critical.

#### `src/lib/ai/providers/index.ts`
**Purpose:** Provider factory/registry.
**Issues:**
- None. Clean dispatch to correct provider based on model tier.
**Recommended action:** None.

#### `src/lib/ai/providers/types.ts`
**Purpose:** TypeScript interfaces for AI providers.
**Issues:**
- None.
**Recommended action:** None.

#### `src/lib/ai/cost-tracker.ts`
**Purpose:** Token cost calculation and logging to usage_logs table.
**Issues:**
- None. Records per-request cost for billing transparency.
**Recommended action:** None.

#### `src/lib/ai/prompts/answer-generator.ts`
**Purpose:** System and user prompt templates for RAG answer generation.
**Issues:**
- None. Prompts are well-structured with clear instructions and context formatting.
**Recommended action:** None.

#### `src/lib/ai/sanitize.ts`
**Purpose:** Prompt injection defense.
**Issues:**
- **[MEDIUM, Lines 6-33]** Regex-based sanitization is a defense-in-depth measure, not a complete solution. Prompt injection via Unicode homoglyphs, encoded characters, or novel patterns will bypass these rules. However, since the AI is only generating security questionnaire answers (not executing code), the blast radius of a bypass is limited to answer quality degradation.
- `truncateForEmbedding` (line 47) at 8000 chars is reasonable.
**Recommended action:** Consider additional defense via output validation (checking that AI responses don't contain instruction-like content).

---

### RAG Pipeline (`src/lib/rag/`)

#### `src/lib/rag/chunk.ts`
**Purpose:** Document text chunking with overlap.
**Issues:**
- None. Clean token-based chunking with configurable overlap.
**Recommended action:** None.

#### `src/lib/rag/embed.ts`
**Purpose:** Vector embedding generation via OpenAI.
**Issues:**
- Line 14-15: `MAX_BATCH_SIZE = 100` and retry logic are well-implemented.
- Line 36: Sorting by `index` to maintain order is correct.
**Recommended action:** None.

#### `src/lib/rag/retrieve.ts`
**Purpose:** Vector similarity search for RAG context retrieval.
**Issues:**
- **[LOW, Line 30]** Embedding string construction `[${queryEmbedding.join(",")}]` is passed through Drizzle's `sql` template tag. Drizzle parameterizes these values, so this is safe from SQL injection despite looking suspicious. The `::vector` cast works on the parameterized value server-side.
- Line 76: Dynamic `import()` of schema in `retrieveFromAnswerLibrary` is unnecessary (schema is already available at module level). Likely a workaround for a circular dependency.
- Lines 44-45: Proper orgId filtering on vector search. Good.
**Recommended action:** Clean up the dynamic import on line 76.

#### `src/lib/rag/generate.ts`
**Purpose:** Orchestrates RAG: retrieve -> prompt -> generate -> score.
**Issues:**
- Line 25-27: Model tier selection (Haiku for yes/no, Sonnet for freetext) is a smart cost optimization.
- Line 44: Answer library check first (similarity > 0.85) before hitting the AI is a good optimization.
- **[LOW, Line 29-35]** `getCompanyName` queries the org table by `clerkOrgId` on every answer generation. Should be cached or passed as parameter since it's called in a loop during batch processing.
**Recommended action:** Cache company name during batch processing.

#### `src/lib/rag/ingest.ts`
**Purpose:** Full document ingestion pipeline.
**Issues:**
- **[MEDIUM, Lines 82-87]** Deletes existing chunks before inserting new ones (re-processing case) but this is **not wrapped in a transaction**. If the insert fails after the delete, the document loses all its chunks with no recovery.
- Line 100: Batch inserts of 50 chunks at a time. Good.
**Recommended action:** Wrap delete + insert in a database transaction.

#### `src/lib/rag/confidence.ts`
**Purpose:** Confidence scoring based on similarity thresholds.
**Issues:**
- None. Clean threshold-based scoring (high >0.7, medium 0.5-0.7, low 0.3-0.5, none <0.3).
**Recommended action:** None.

---

### Parsers (`src/lib/parsers/`)

#### `src/lib/parsers/index.ts`
**Purpose:** Router that dispatches to correct parser by file type.
**Issues:**
- None. Clean switch statement.
**Recommended action:** None.

#### `src/lib/parsers/excel.ts`
**Purpose:** XLSX parsing via exceljs.
**Issues:**
- None. Extracts text from all worksheets, handles cell types.
**Recommended action:** None.

#### `src/lib/parsers/word.ts`
**Purpose:** DOCX parsing via mammoth.
**Issues:**
- None. Extracts raw text from DOCX.
**Recommended action:** None.

#### `src/lib/parsers/pdf.ts`
**Purpose:** PDF parsing via pdf-parse.
**Issues:**
- **[LOW]** `pdf-parse` loads the entire PDF into memory. Combined with the 50MB upload limit, this could consume significant memory on serverless.
**Recommended action:** Monitor memory usage; consider streaming PDF parser for large files.

#### `src/lib/parsers/questionnaire.ts`
**Purpose:** Specialized Excel questionnaire parser with column detection.
**Issues:**
- None. Intelligent heuristic for detecting question/answer columns. Handles multi-sheet workbooks.
**Recommended action:** None.

---

### Storage (`src/lib/storage/`)

#### `src/lib/storage/r2.ts`
**Purpose:** Cloudflare R2 (S3-compatible) file operations.
**Issues:**
- Lines 53, 71, 88: OrgId prefix validation on download/delete/signedUrl is excellent security - prevents cross-tenant file access via path manipulation.
- **[LOW, Line 10-17]** S3 client initialized at module level with non-null assertions on env vars. Safe if `validateEnv()` runs at startup, but it doesn't (see env.ts issue).
**Recommended action:** Ensure env validation runs before this module loads.

---

### Server Actions (`src/lib/actions/`)

#### `src/lib/actions/documents.ts`
**Purpose:** Server actions for document CRUD.
**Issues:**
- **[HIGH, Lines 94-108]** Document deletion performs three sequential operations (delete chunks, delete document, delete R2 file) with **no database transaction**. If R2 deletion fails, the DB records are already gone, creating orphaned R2 objects. If the document delete fails after chunk delete, chunks are lost.
- All queries correctly filter by orgId. Good.
**Recommended action:** Wrap DB operations in a transaction. Do R2 cleanup after DB transaction commits (or via a cleanup queue).

#### `src/lib/actions/answer-library.ts`
**Purpose:** Server actions for answer library CRUD.
**Issues:**
- None critical. Properly uses auth() for orgId scoping.
**Recommended action:** None.

#### `src/lib/actions/questionnaires.ts`
**Purpose:** Server actions for questionnaire CRUD.
**Issues:**
- None critical. Properly org-scoped.
**Recommended action:** None.

---

### Export (`src/lib/export/`)

#### `src/lib/export/excel-export.ts`
**Purpose:** XLSX export of questionnaire answers.
**Issues:**
- None. Clean exceljs-based export with proper formatting.
**Recommended action:** None.

#### `src/lib/export/word-export.ts`
**Purpose:** DOCX export using docx library.
**Issues:**
- None. Well-structured with sections, table of contents consideration.
**Recommended action:** None.

---

### Email & Demo (`src/lib/email/`, `src/lib/demo/`)

#### `src/lib/email/templates.ts`
**Purpose:** Email template definitions.
**Issues:**
- None. Template definitions only (no send logic seen).
**Recommended action:** None.

#### `src/lib/demo/sample-data.ts`
**Purpose:** Sample data constants for demo seeding.
**Issues:**
- None.
**Recommended action:** None.

#### `src/lib/demo/seed.ts`
**Purpose:** Demo data seeding logic.
**Issues:**
- **[LOW]** No idempotency check - calling seed multiple times creates duplicate data.
**Recommended action:** Add check for existing demo data before seeding.

---

### API Routes (`src/app/api/`)

#### `src/app/api/upload/route.ts`
**Purpose:** File upload with validation, R2 storage, and async ingestion.
**Issues:**
- **[CRITICAL, Line 171-173]** Fire-and-forget `ingestDocument().catch()` call. On Vercel, the serverless function terminates after the response is sent. The background ingestion will be killed mid-execution. The document will be stuck in "processing" status permanently.
- Lines 21-31: Magic byte validation for file type verification. Excellent security measure.
- Lines 34-41: Filename sanitization with path traversal prevention. Good.
- Lines 43-48: Double extension detection. Good.
- Line 131: `Buffer.from(await file.arrayBuffer())` loads entire file (up to 50MB) into memory. Acceptable for serverless with reasonable limits.
- Rate limiting (line 76) uses the in-memory limiter (see critical issue above).
**Recommended action:** Use Vercel's `waitUntil()` for background work, or call the ingest API as a separate HTTP request, or use a job queue.

#### `src/app/api/ingest/route.ts`
**Purpose:** Explicit document ingestion trigger.
**Issues:**
- **[MEDIUM, Line 33]** Unlike the upload route, this runs ingestion synchronously. On large documents, this could hit the 60-second function timeout.
**Recommended action:** Consider chunked/streaming processing for large documents.

#### `src/app/api/documents/route.ts`
**Purpose:** List documents for org.
**Issues:**
- **[LOW]** No pagination. Returns all documents. Will degrade with large knowledge bases.
**Recommended action:** Add cursor or offset pagination.

#### `src/app/api/documents/[id]/route.ts`
**Purpose:** Single document GET/DELETE.
**Issues:**
- Proper orgId filtering on both operations. Good.
**Recommended action:** None.

#### `src/app/api/documents/[id]/chunks/route.ts`
**Purpose:** Paginated chunks for a document.
**Issues:**
- None. Proper pagination with offset/limit. Good.
**Recommended action:** None.

#### `src/app/api/questionnaires/route.ts`
**Purpose:** List and create questionnaires.
**Issues:**
- **[LOW, Line 16-20]** GET returns all questionnaires with no pagination.
- Line 87-99: Batch question insertion in groups of 50. Good.
- Plan limit enforcement on creation. Good.
**Recommended action:** Add pagination to GET.

#### `src/app/api/questionnaires/[id]/route.ts`
**Purpose:** Single questionnaire GET/DELETE.
**Issues:**
- Proper orgId filtering. Good.
**Recommended action:** None.

#### `src/app/api/questionnaires/[id]/questions/route.ts`
**Purpose:** Question list and update (single + bulk).
**Issues:**
- **[HIGH, Lines 116-127]** Bulk update iterates over `questionIds` and executes individual `UPDATE` queries in a loop. For 500 questions (the max per questionnaire), this is 500 individual DB round-trips. This should be a single `WHERE id IN (...)` query.
- **[MEDIUM, Lines 116-127]** The bulk update loop is also **not wrapped in a transaction**. If it fails midway, some questions are updated and others aren't.
- Lines 80-98: Single question update properly uses allowlisted fields to prevent mass assignment. Good.
**Recommended action:** Replace N+1 loop with a single batched update in a transaction.

#### `src/app/api/questionnaires/[id]/progress/route.ts`
**Purpose:** Processing progress polling.
**Issues:**
- None. Simple read-only endpoint.
**Recommended action:** None.

#### `src/app/api/questionnaires/[id]/export/route.ts`
**Purpose:** Export questionnaire as XLSX or DOCX.
**Issues:**
- Lines 62-78: Pre-export validation requiring all questions to be resolved. Good workflow enforcement.
- Lines 123-125: Filename sanitization for Content-Disposition header. Good.
- **[LOW, Line 114-120]** Audit logging on export. Good.
**Recommended action:** None.

#### `src/app/api/questionnaires/parse/route.ts`
**Purpose:** Parse uploaded XLSX to extract questions.
**Issues:**
- None critical. Validates file type, uses questionnaire parser.
**Recommended action:** None.

#### `src/app/api/questionnaires/process/route.ts`
**Purpose:** Trigger AI answer generation for a questionnaire.
**Issues:**
- **[CRITICAL, Line 85-87]** Same fire-and-forget problem as upload route. `processQuestions().catch()` runs background work that will be killed when the serverless function terminates.
- **[HIGH, Lines 10-12]** The process schema only accepts `questionnaireId`. But the review page (`[id]/page.tsx:319-326`) sends `{ questionnaireId, questionIds: [...] }` when regenerating a single answer. The `questionIds` field is silently ignored, and the entire questionnaire is reprocessed instead. This is a functional bug.
- Lines 119-165: Sequential processing of questions (one by one). For 500 questions, this takes a long time. Consider parallel batches (e.g., 5 concurrent).
- Line 60-64: Re-processing guard (rejects if already processing). Good.
**Recommended action:** Fix the `questionIds` parameter support. Use `waitUntil()` or a job queue for background processing.

#### `src/app/api/answer-library/route.ts`
**Purpose:** Answer library CRUD.
**Issues:**
- **[MEDIUM, Lines 104-106]** DELETE takes `id` from query parameters but doesn't validate it as a UUID with Zod. A non-UUID string passed to the delete action could cause a DB error.
- **[MEDIUM, Lines 30, 57, 86, 114]** The GET/POST/PATCH/DELETE handlers all check `orgId` from auth, but the `getLibraryEntries()`, `addToLibrary()`, `updateLibraryEntry()`, and `deleteLibraryEntry()` functions are server actions that call `auth()` internally. This means auth is checked twice (once in the API route, once in the server action), but the orgId from the API route is never passed to the action. The actions re-derive it independently. This is redundant but not a security issue.
**Recommended action:** Validate `id` as UUID in DELETE. Decide on one auth pattern (API-level or action-level).

#### `src/app/api/billing/route.ts`
**Purpose:** Billing info and Stripe checkout/portal actions.
**Issues:**
- **[LOW, Lines 52-64]** Defensive handling of Stripe SDK v20 camelCase vs snake_case field names. Pragmatic but brittle.
- Proper Zod validation on POST body. Good.
**Recommended action:** Pin Stripe SDK version or use typed accessors.

#### `src/app/api/dashboard/route.ts`
**Purpose:** Dashboard statistics.
**Issues:**
- None. Read-only aggregation endpoint.
**Recommended action:** None.

#### `src/app/api/demo/seed/route.ts`
**Purpose:** Seed demo/sample data.
**Issues:**
- **[MEDIUM, Line 8-14]** No role-based access control. Any authenticated org member can seed demo data, not just admins/owners. In a multi-user org, a member could pollute the knowledge base with demo data.
**Recommended action:** Add role check (owner/admin only).

#### `src/app/api/webhooks/stripe/route.ts`
**Purpose:** Stripe webhook handler for subscription events.
**Issues:**
- Line 84: Proper `stripe.webhooks.constructEvent()` signature verification. Good.
- Lines 41-53: Idempotency guard via `stripeEvents` table. Good.
- **[LOW, Line 79]** `process.env.STRIPE_WEBHOOK_SECRET!` non-null assertion. Will throw a cryptic error at runtime if the env var is missing (compounded by the fact that `validateEnv()` is never called).
- **[MEDIUM, Lines 150-153]** Returns HTTP 200 even on handler errors to prevent Stripe retries. This means a bug in the handler logic could silently fail and the subscription state could become inconsistent. The comment explains the reasoning but this should at least alert/log prominently.
**Recommended action:** Add alerting for webhook handler failures.

---

### Pages & Layouts (`src/app/`)

#### `src/app/layout.tsx`
**Purpose:** Root layout with ClerkProvider.
**Issues:**
- None. Standard Next.js root layout.
**Recommended action:** None.

#### `src/app/globals.css`
**Purpose:** Global styles with Tailwind and CSS custom properties.
**Issues:**
- None. Clean theme variable system.
**Recommended action:** None.

#### `src/app/not-found.tsx`
**Purpose:** 404 page.
**Issues:**
- None. Simple and functional.
**Recommended action:** None.

#### `src/app/robots.ts`
**Purpose:** Robots.txt generation.
**Issues:**
- None.
**Recommended action:** None.

#### `src/app/sitemap.ts`
**Purpose:** Sitemap generation.
**Issues:**
- None.
**Recommended action:** None.

#### `src/app/(auth)/layout.tsx`
**Purpose:** Centered layout for auth pages.
**Issues:**
- None.
**Recommended action:** None.

#### `src/app/(auth)/sign-in/[[...sign-in]]/page.tsx`
**Purpose:** Clerk sign-in page.
**Issues:**
- None. Standard Clerk component.
**Recommended action:** None.

#### `src/app/(auth)/sign-up/[[...sign-up]]/page.tsx`
**Purpose:** Clerk sign-up page.
**Issues:**
- None. Standard Clerk component.
**Recommended action:** None.

#### `src/app/(marketing)/layout.tsx`
**Purpose:** Marketing pages layout.
**Issues:**
- None.
**Recommended action:** None.

#### `src/app/(marketing)/page.tsx`
**Purpose:** Landing page with hero, features, pricing.
**Issues:**
- None critical. Standard marketing page.
**Recommended action:** None.

#### `src/app/dashboard/layout.tsx`
**Purpose:** Dashboard layout with sidebar navigation.
**Issues:**
- None. Well-structured navigation.
**Recommended action:** None.

#### `src/app/dashboard/page.tsx`
**Purpose:** Dashboard home with stats cards.
**Issues:**
- **[LOW]** `catch { }` silent error handling on data fetch (line ~30). Should show an error state.
**Recommended action:** Add error state handling.

#### `src/app/dashboard/loading.tsx`
**Purpose:** Loading skeleton.
**Issues:**
- None. Good UX.
**Recommended action:** None.

#### `src/app/dashboard/error.tsx`
**Purpose:** Error boundary.
**Issues:**
- None. Proper client error boundary with reset functionality.
**Recommended action:** None.

#### `src/app/dashboard/onboarding/page.tsx`
**Purpose:** New user onboarding flow.
**Issues:**
- None critical.
**Recommended action:** None.

#### `src/app/dashboard/knowledge-base/page.tsx`
**Purpose:** Document list with upload dropzone.
**Issues:**
- **[LOW]** `catch { }` silent error on fetch (same pattern as other pages).
- Has polling for processing status. Good.
**Recommended action:** Add error state.

#### `src/app/dashboard/knowledge-base/[id]/page.tsx`
**Purpose:** Document detail with chunk viewer.
**Issues:**
- Good pagination for chunks. Good reprocess/delete functionality.
**Recommended action:** None.

#### `src/app/dashboard/questionnaires/page.tsx`
**Purpose:** Questionnaire list page.
**Issues:**
- **[LOW, Line 98-99]** `catch { // silently fail }` on fetch. User sees empty state with no indication of error.
- Good: Polls for processing status (lines 110-118).
**Recommended action:** Add error state.

#### `src/app/dashboard/questionnaires/[id]/page.tsx`
**Purpose:** Question review page with split panel UI.
**Issues:**
- **[HIGH, Lines 319-326]** `handleRegenerate` sends `{ questionnaireId, questionIds: [selectedQuestion.id] }` to `/api/questionnaires/process`, but that API only accepts `questionnaireId` and ignores `questionIds`. Instead of regenerating one answer, it reprocesses the entire questionnaire, overwriting all existing answers. This is a significant functional bug.
- **[LOW, Line 150]** `catch { // silently fail }` on data fetch.
- Line 806: `(selectedQuestion.sourceChunkIds as string[])` type assertion. Works but fragile.
- Good: Comprehensive review workflow (approve, reject, skip, regenerate, bulk approve, save to library, export).
**Recommended action:** Fix regenerate to only process selected question(s). Add error state.

#### `src/app/dashboard/questionnaires/import/page.tsx`
**Purpose:** 3-step import wizard.
**Issues:**
- None critical. Good multi-step UX with preview before import.
**Recommended action:** None.

#### `src/app/dashboard/answer-library/page.tsx`
**Purpose:** Answer library CRUD with search.
**Issues:**
- **[LOW]** Same silent error swallowing pattern.
**Recommended action:** Add error state.

#### `src/app/dashboard/settings/page.tsx`
**Purpose:** Settings with General, Team, Billing tabs.
**Issues:**
- **[LOW, Lines 189-219]** General and Team tabs are empty placeholders ("will be available here"). Acceptable for MVP but should be noted.
- Billing tab is functional with plan usage bars and Stripe checkout.
**Recommended action:** Remove placeholder tabs or implement them before the deal closes.

---

### Components (`src/components/`)

#### `src/components/knowledge-base/upload-dropzone.tsx`
**Purpose:** Drag-and-drop file upload with XHR progress tracking.
**Issues:**
- **[CRITICAL, Line 62]** `const index = uploads.length;` captures the current uploads array length at the time `uploadFile` is called. But `uploadFile` is in a `useCallback` with `[uploads.length, ...]` as a dependency, and `setUploads` is batched. When multiple files are dropped simultaneously, all files get the same `index` value because `uploads.length` hasn't updated yet (React state batching). This means all files' progress updates target the same array position, resulting in corrupted progress tracking.
- **[LOW, Line 93]** XHR error handler doesn't parse `responseText` safely - `JSON.parse(xhr.responseText)` will throw on non-JSON error responses, making the Promise reject with a parse error instead of the actual server error.
**Recommended action:** Fix the stale closure bug by using a ref or functional state update with a stable identifier instead of array index. Add try/catch around JSON.parse.

#### `src/components/knowledge-base/document-table.tsx`
**Purpose:** Document list table with delete confirmation dialog.
**Issues:**
- None critical. Well-structured with proper confirmation UX for deletion.
**Recommended action:** None.

#### `src/components/ui/` (13 files: badge, button, card, dialog, dropdown-menu, input, label, progress, separator, sheet, tabs, toast, toaster)
**Purpose:** shadcn/ui component library (Radix UI primitives + Tailwind CSS).
**Issues:**
- **[LOW]** `src/components/ui/sheet.tsx` is **never imported** anywhere in the codebase. Dead code.
- All other components are standard shadcn/ui generated code. No custom modifications that could introduce bugs.
**Recommended action:** Delete `sheet.tsx` if unused.

---

### Hooks (`src/hooks/`)

#### `src/hooks/use-toast.ts`
**Purpose:** Toast notification system with external state management.
**Issues:**
- **[MEDIUM, Line 179]** `useEffect` has `[state]` in the dependency array. This causes the listener to be removed and re-added on every state change, which is unnecessary and creates a brief window where toasts could be missed. Should be `[]` (empty deps) since `setState` is a stable reference.
- Line 7-8: `TOAST_LIMIT = 1` and `TOAST_REMOVE_DELAY = 1000000` (16+ minutes). The long remove delay means toasts accumulate in memory. Since limit is 1, this is fine in practice.
**Recommended action:** Change dependency array to `[]`.

---

### Tests (`tests/`)

#### 17 test files covering:
- AI: cost calculation, prompt sanitization, retry logic
- Billing: plan limits
- Export: Excel export
- Parsers: error handling, Excel, questionnaire detection
- RAG: chunking, confidence scoring, retrieval (with mocked DB)
- Security: input sanitization, rate limiting, tenant isolation (schema verification), validation schemas
- Smoke: data integrity, integration pipeline

**Issues:**
- **[MEDIUM]** No integration tests that hit actual API routes. All tests mock the database layer. This means authentication/authorization flows, request validation, and end-to-end data flow are untested.
- **[LOW]** No tests for the export/word-export module.
- **[LOW]** Tenant isolation test only verifies schema structure (that orgId columns exist), not runtime query filtering.
- Test coverage for core logic (chunking, confidence, cost calculation, sanitization) is good.
**Recommended action:** Add API route integration tests (at minimum for auth flows and critical paths like upload -> ingest -> retrieve). Add word export tests.

---

## Global Issues

### 1. Fire-and-Forget Background Work on Serverless (CRITICAL)
Two API routes (`upload/route.ts:171` and `questionnaires/process/route.ts:85`) use fire-and-forget async calls to do heavy background processing. On Vercel serverless, the function terminates after the response is sent, killing the background work. Documents get stuck in "processing" forever.

### 2. In-Memory Rate Limiting (CRITICAL)
`rate-limit.ts` uses an in-memory Map. Each serverless cold start gets a fresh Map. There is no shared state between instances. Rate limiting is non-functional in production.

### 3. No Database Transactions (HIGH)
Multiple multi-step destructive operations lack transactions:
- Document deletion (chunks -> document -> R2)
- Document re-ingestion (delete old chunks -> insert new chunks)
- Bulk question updates (individual updates in a loop)

### 4. Silent Error Swallowing (MEDIUM)
At least 6 pages use `catch { // silently fail }` or `catch { }` with no error UI. Users see empty states with no indication that something went wrong.

### 5. Duplicated Utility Functions (LOW)
`formatDate()` is defined in 3+ files. `StatusBadge` component is duplicated in `document-table.tsx` and `questionnaires/page.tsx`. `formatFileSize()` is in `document-table.tsx` and `constants.ts`.

### 6. Environment Validation Never Runs (CRITICAL)
`validateEnv()` in `env.ts` is exported but never imported or called. Missing environment variables cause cryptic runtime crashes instead of clear startup failures.

### 7. Regenerate Bug (HIGH)
The "Regenerate" button on the question review page reprocesses the **entire questionnaire** instead of just the selected question, silently overwriting all existing answers.

---

## Prioritized Action Plan

### Must Fix Before Production

1. **Call `validateEnv()` at application startup** - `src/lib/env.ts:39` is dead code. Import and call it in instrumentation hook or root server component.

2. **Replace in-memory rate limiter with Redis/Upstash** - `src/lib/rate-limit.ts` is non-functional on serverless. Use Upstash `@upstash/ratelimit` or similar.

3. **Fix fire-and-forget background processing** - `src/app/api/upload/route.ts:171` and `src/app/api/questionnaires/process/route.ts:85`. Use Vercel `waitUntil()`, or a job queue (Inngest, QStash, BullMQ), or break ingestion into a separate API call from the client with polling.

4. **Fix upload dropzone stale closure bug** - `src/components/knowledge-base/upload-dropzone.tsx:62`. Use a ref for tracking upload count or identify files by unique ID instead of array index.

5. **Fix regenerate bug** - `src/app/api/questionnaires/process/route.ts:10-12` needs to accept optional `questionIds` parameter. `src/app/dashboard/questionnaires/[id]/page.tsx:319-326` already sends it but it's ignored.

6. **Add database transactions** to:
   - Document deletion (`src/lib/actions/documents.ts:94-108`)
   - Document re-ingestion (`src/lib/rag/ingest.ts:82-104`)
   - Bulk question updates (`src/app/api/questionnaires/[id]/questions/route.ts:116-127`)

7. **Fix bulk update N+1 query** - `src/app/api/questionnaires/[id]/questions/route.ts:116-127`. Replace the loop with a single `UPDATE ... WHERE id IN (...)` query.

8. **Fix use-toast dependency array** - `src/hooks/use-toast.ts:179`. Change `[state]` to `[]`.

### Should Fix

9. **Add error states to all dashboard pages** - Replace `catch { }` silent failures with user-visible error messages in: `dashboard/page.tsx`, `knowledge-base/page.tsx`, `questionnaires/page.tsx`, `questionnaires/[id]/page.tsx`, `answer-library/page.tsx`.

10. **Add pagination to list endpoints** - `GET /api/questionnaires` and `GET /api/documents` return all records with no pagination.

11. **Add role check to demo seed endpoint** - `src/app/api/demo/seed/route.ts` should require admin/owner role.

12. **Validate `id` parameter in answer library DELETE** - `src/app/api/answer-library/route.ts:105` should validate as UUID.

13. **Add API route integration tests** - Current tests only mock the database. Need tests that verify auth, validation, and end-to-end flows.

14. **Add webhook failure alerting** - `src/app/api/webhooks/stripe/route.ts:150-153` silently returns 200 on handler errors.

### Nice to Fix

15. **Centralize duplicated utilities** - Extract shared `formatDate`, `StatusBadge`, `formatFileSize` into shared modules.

16. **Cache company name during batch processing** - `src/lib/rag/generate.ts:29-35` queries the DB on every answer generation.

17. **Delete unused `sheet.tsx`** - `src/components/ui/sheet.tsx` is never imported.

18. **Remove or implement placeholder settings tabs** - General and Team tabs in `settings/page.tsx` are empty.

19. **Clean up dynamic import in retrieve.ts** - `src/lib/rag/retrieve.ts:76` uses unnecessary dynamic `import()`.

20. **Delete or use `src/lib/auth.ts`** - `getCurrentUser()` is defined but never used. Either use it consistently or remove it.

21. **Add Content-Security-Policy headers** - No CSP headers configured.

22. **Add audit log cleanup strategy** - `audit_logs` table will grow unbounded.

---

## Files to Delete

| File | Reason |
|------|--------|
| `src/components/ui/sheet.tsx` | Never imported or used anywhere in the codebase |
| `src/lib/auth.ts` | `getCurrentUser()` is never called; all API routes use `auth()` directly from Clerk |

**Note:** These are the only files that are truly dead code. All other files serve a purpose in the current architecture.
