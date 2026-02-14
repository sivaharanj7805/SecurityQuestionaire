# SecureQuest — Security Questionnaire AI Responder

## Tech Stack (do not deviate)
- Framework: Next.js 15 App Router, TypeScript, pnpm
- Database: PostgreSQL 16 + pgvector extension
- ORM: Drizzle ORM (NOT Prisma — we need raw SQL for pgvector)
- Auth: Clerk (organizations + roles)
- Payments: Stripe (subscriptions)
- AI: Anthropic Claude API (primary), OpenAI (embeddings)
- Storage: Cloudflare R2 (S3-compatible)
- UI: shadcn/ui + Tailwind CSS

## Code Rules
- src/ directory for all code
- Type everything. No "any".
- Every table with tenant data MUST have orgId column
- Every DB query MUST filter by orgId from Clerk session
- Use zod for all input validation
- kebab-case files, PascalCase components
