# SecureQuest — AI-Powered Security Questionnaire Responder

Answer security questionnaires 10x faster with AI. Upload your knowledge base, import questionnaires, and let AI draft accurate responses.

## Tech Stack

- **Framework:** Next.js 15 (App Router), TypeScript
- **Database:** PostgreSQL 16 + pgvector
- **ORM:** Drizzle ORM
- **Auth:** Clerk (organizations + roles)
- **Payments:** Stripe (subscriptions)
- **AI:** Anthropic Claude (answer generation), OpenAI (embeddings)
- **Storage:** Cloudflare R2 (S3-compatible)
- **UI:** shadcn/ui + Tailwind CSS
- **Email:** Resend
- **Testing:** Vitest

## Prerequisites

- Node.js 20+
- pnpm 9+
- PostgreSQL 16 with pgvector extension
- Accounts: Clerk, Stripe, Anthropic, OpenAI, Cloudflare R2, Resend

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd SecurityQuestionaire
pnpm install
```

### 2. Environment variables

Copy `.env.example` to `.env` and fill in:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/securequest

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...

# Stripe
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_GROWTH=price_...
STRIPE_PRICE_SCALE=price_...

# AI
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# Cloudflare R2
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=securequest
R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com

# Resend
RESEND_API_KEY=re_...
EMAIL_FROM="SecureQuest <noreply@securequest.app>"

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Database setup

```bash
# Push schema to database
pnpm db:push

# Or generate and run migrations
pnpm db:generate
pnpm db:migrate
```

### 4. Run

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm test` | Run tests |
| `pnpm test:watch` | Run tests in watch mode |
| `pnpm lint` | Run ESLint |
| `pnpm db:push` | Push schema to database |
| `pnpm db:studio` | Open Drizzle Studio |
| `pnpm db:generate` | Generate migrations |
| `pnpm db:migrate` | Run migrations |

## Architecture

```
src/
├── app/                    # Next.js App Router pages & API routes
│   ├── api/               # API routes
│   │   ├── answer-library/
│   │   ├── billing/
│   │   ├── dashboard/
│   │   ├── documents/
│   │   ├── questionnaires/
│   │   ├── upload/
│   │   └── webhooks/stripe/
│   └── dashboard/         # Dashboard pages
│       ├── answer-library/
│       ├── knowledge-base/
│       ├── onboarding/
│       ├── questionnaires/
│       └── settings/
├── components/            # React components
│   ├── ui/               # shadcn/ui primitives
│   └── knowledge-base/   # Feature components
└── lib/                   # Core logic
    ├── ai/               # AI providers (Anthropic) & prompts
    ├── billing/          # Stripe, plans, enforcement
    ├── db/               # Drizzle schema & connection
    ├── demo/             # Sample data seeder
    ├── email/            # Email templates (Resend)
    ├── export/           # XLSX & DOCX export
    ├── parsers/          # Document parsers (Excel, Word, PDF)
    ├── rag/              # RAG pipeline (chunk, embed, retrieve, generate)
    └── storage/          # Cloudflare R2 client
```

## Key Features

- **Knowledge Base:** Upload PDFs, DOCX, XLSX. Documents are parsed, chunked, and embedded for vector search.
- **RAG Pipeline:** Retrieves relevant context from your knowledge base using pgvector cosine similarity, then generates answers with Claude.
- **Questionnaire Import:** Import Excel questionnaires, AI processes all questions in batch.
- **Review Interface:** Split-layout review page with approve/reject/regenerate/skip actions, bulk operations, and keyboard navigation.
- **Answer Library:** Approved answers are saved with embeddings for automatic reuse on similar questions.
- **Export:** Download completed questionnaires as styled XLSX or DOCX.
- **Billing:** Stripe subscriptions with plan limits enforcement.
- **Multi-tenant:** All data is isolated by organization (orgId on every table and query).

## Deployment

Configured for Vercel deployment:

```bash
vercel deploy
```

See `vercel.json` for function timeout and region configuration.
