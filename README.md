# Hydrascapes

A co-hosting marketplace for short-term rentals. Owners list properties, hosts manage
stays, guests book them — with AI-assisted property analysis, identity checks and
payments designed to fail safe.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
Supabase (Postgres, Auth, Storage) · Stripe · a provider-agnostic AI layer.

---

## Status

This repository is **not finished**. Being explicit about that is more useful than a
feature list that reads like a brochure.

| Phase | Scope | State |
| :--- | :--- | :--- |
| 1 — Foundation | Auth, roles, RLS, dashboards | ✅ Done |
| 2 — Property + vision | Property CRUD, private uploads, AI analysis, search | ✅ Done |
| 3 — Bookings + payments | Availability, quotes, Stripe Connect, payouts | ⛔ Not built |
| 4 — Trust | KYC, host applications, messaging, reviews | ⛔ Not built |
| 5 — Pricing + disputes | Pricing engine, price calendar, dispute assessment | 🟡 Vision price hint only |
| 6 — Admin + automation | Admin portal, n8n workflows, email | ⛔ Not built |
| 7 — Security + ops | Rate limits, headers, privacy routes, ops docs | 🟡 Partial |

**What works end to end:** sign up → get a role dashboard → upload property photos →
private re-encoded storage → background schema-validated vision analysis →
Property Eye card → publish → find it in `/search` → view `/property/[id]`.

**What does not work yet:** there is no way to book a stay, take a payment, verify a
host's identity, message anyone, or open a dispute. Those are Phases 3–5. Admin pages
show counts only.

### Signature verification, quickly

- All money is stored and computed as **integer minor units** (`app/lib/money.ts`).
- **AI never computes money.** Models return bounded classifications; pricing is
  deterministic TypeScript (`app/lib/pricing/refine.ts`) and capped by configuration.
- Every structured model response passes a **Zod schema** before use
  (`app/lib/ai/schemas.ts`, `app/lib/ai/structured.ts`).
- Images live in **private buckets** and are read through short-lived signed URLs.
- The Supabase **service-role key is server-only**; every route checks authorization itself.
- Stripe webhooks are **signature-verified and idempotent** (`processed_webhook_events`).

---

## Getting started

### Prerequisites

- Node.js 20+ (22 recommended)
- Docker (for the local Supabase stack)
- [Supabase CLI](https://supabase.com/docs/guides/cli)

### 1. Install

```bash
npm install
```

### 2. Start Supabase and apply migrations

```bash
supabase start          # boots Postgres, Auth, Storage, Studio locally
supabase db reset       # applies supabase/migrations/0001 … 0011
```

`supabase start` prints the local API URL and keys — copy them into your env file.

### 3. Configure environment

```bash
cp .env.example .env.local
```

Every variable is documented inline in `.env.example`. The ones you cannot skip:

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Local API URL from `supabase start` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key (RLS is the real gate) |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Server-side only, never in the browser |
| `NEXT_PUBLIC_APP_URL` | Canonical URL; must match the port you run on |

Optional unless you use the feature:

| Variable | Purpose |
| :--- | :--- |
| `AI_API_KEY` / `OPENROUTER_API_KEY` | Enables vision. Absent → AI features degrade, listings still work |
| `AI_MODEL` | Vision-capable model id. Configuration, never code |
| `AI_BASE_URL`, `AI_FALLBACK_{1,2}_*` | Any OpenAI-compatible endpoint + fallbacks |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Webhook endpoint only, until Phase 3 |
| `INTERNAL_API_TOKEN` | Machine-to-machine calls (n8n), Phase 6 |

### 4. Run

```bash
npm run dev      # http://localhost:3000 — set NEXT_PUBLIC_APP_URL to match
```

### 5. Sign in

Create an account at `/signup`. **Admin cannot be self-selected** — the database trigger
coerces it. To make a local admin:

```sql
update public.profiles set role = 'admin' where email = 'you@example.com';
```

---

## Scripts

| Command | What it does |
| :--- | :--- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint, zero warnings tolerated |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest, all suites |
| `npm run test:watch` | Vitest in watch mode |

### Tests

Unit suites (`money`, `pricing`, `ai-validation`, `rate-limit`, `storage`) run anywhere,
no infrastructure needed:

```bash
npx vitest run tests/money.test.ts tests/pricing.test.ts tests/ai-validation.test.ts \
               tests/rate-limit.test.ts tests/storage.test.ts
```

`tests/rls.test.ts` is an **integration** suite: it needs a running local Supabase with
seed data (`supabase start && supabase db reset`) and will fail without one.

---

## Architecture

```
app/
  core/              Domain layer — no framework, no vendor imports
    entities/        Row types + enums, mirroring supabase/migrations/0001
    usecases/        create-property, analyze-property
  lib/
    ai/              provider (transport) → structured (aiJson boundary) → vision (task)
    pricing/         Deterministic refinements; money computed here, never by a model
    storage/         Upload validation, sharp re-encode, signed URL minting
    supabase/        Browser / server / service clients + session middleware
    money.ts         Integer minor-unit parsing and formatting
    authorization.ts requireUser / requireRole for route handlers
    rate-limit.ts    Postgres-backed, fixed-window
  api/               Route handlers (properties, uploads, webhooks)
  property/[id]/     Public detail page
  search/            Public discovery
infrastructure/      Adapters implementing the ports the core depends on
legacy/              Earlier prototype (Firebase). Excluded from build, lint and tsc.
                     Kept for reference only — do not import from it.
```

**Dependency rule:** `core` → `lib/ai/port` interfaces; `infrastructure` implements them.
Nothing in `core` imports a vendor SDK.

### Database

Eleven migrations in `supabase/migrations/`, applied in order:

`0001` schema (21 tables, enums, constraints) · `0002` RLS policies · `0003` safe mutation
RPCs · `0004` private storage buckets · `0005` dev seed · `0006` grants · `0007` review FK ·
`0008` vision config · `0009` storage object policies · `0010` public profile view ·
`0011` rate limits.

Money columns are `bigint` minor units. `properties` enforces
`min_price <= base_price <= max_price` in the database.

---

## Security notes

- **RLS is enabled and forced on all 21 tables.** The API's own checks are a second
  layer, not the only one.
- **Storage is private.** Object paths are `<user-id>/<uuid>.<ext>`; policies allow each
  user their own folder, and everything else is served as a signed URL.
- **Uploads are re-encoded server-side** with sharp: EXIF and GPS stripped, dimensions
  capped. The browser-declared MIME type is not trusted on its own.
- **Rate limits are durable** (Postgres counters), so they hold across serverless
  instances: vision 20/hr, uploads 100/hr, property writes 120/hr, per user.
- **CSP and security headers** are set in `next.config.ts`.
- `.env`, `.env.local` and build output are gitignored. Only `.env.example` is tracked.

Known gaps: no `/api/me*` privacy/export routes yet, no dependency scanning in CI, and
rate limiting currently fails **open** (logged loudly) if migration `0011` is missing.

---

## Roadmap

1. **Bookings & payments** — availability, quotes, Stripe Connect, payout records,
   cancellation arithmetic.
2. **Trust** — Stripe Identity KYC, host applications, messaging, reviews.
3. **Pricing & disputes** — full deterministic pricing engine with a reasoning trace,
   dispute intake and payout freezes.
4. **Admin & automation** — admin portal, n8n suite, transactional email.
5. **Operations** — privacy routes, data map, recovery runbook, role guides.

`docs/SPEC.md` is a stale early summary and does not match this implementation; the
authoritative specification is `HYDRASCAPES BUILD PROMPT AUG 10 2026.md`, including the
vision-schema amendment recorded in §9.
