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
| 3 — Bookings + payments | Availability, quotes, state machine, payouts, cancellation | ✅ Built (Stripe transfers unverified without keys) |
| 4 — Trust | KYC, host applications, messaging, reviews | ⛔ Not built |
| 5 — Pricing + disputes | Pricing engine, price calendar, dispute assessment | 🟡 Vision price hint only |
| 6 — Admin + automation | Admin portal, n8n workflows, email | ⛔ Not built |
| 7 — Security + ops | Rate limits, headers, privacy routes, ops docs | 🟡 Partial |

**What works end to end:** sign up → get a role dashboard → upload property photos →
private re-encoded storage → background schema-validated vision analysis →
Property Eye card → publish → find it in `/search` → view `/property/[id]` →
check dates and price → reserve → pay (or confirm in dev mode) → see the trip in your
dashboard → cancel under the booking's own policy.

**What does not work yet:** host identity verification, messaging, reviews, disputes,
the full pricing engine, the admin portal and automation. Admin pages show counts only.

Payouts are split, recorded and transferred through Stripe Connect, but **no real money
has moved in this environment**: there are no Stripe keys here, so the transfer code is
covered by tests with a fake Connect port rather than a live sandbox. Treat the Stripe
paths (Checkout, refunds, transfers, onboarding) as unverified until they have been run
against test keys.

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

> **Already have a `.env` from an earlier run?** Its keys must match the stack that is
> actually running. Print the live values with `supabase status -o env` and copy
> `API_URL`, `ANON_KEY` and `SERVICE_ROLE_KEY` into `NEXT_PUBLIC_SUPABASE_URL`,
> `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.

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
| `INTERNAL_API_TOKEN` | Machine-to-machine calls for the schedulers (n8n later) |
| `MCP_API_KEY` | Bearer key for the read-only `/api/mcp/*` API used by `mcp-server/` |

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
| `npm run seed:photos` | Generates placeholder cover images for seeded listings |

### Placeholder data

`supabase db reset` seeds demo data: a handful of original fixtures plus **15 listings
across major cities** — New York, London, Paris, Tokyo, Rome, Barcelona, Lisbon,
Amsterdam, Berlin, Miami, Los Angeles, Singapore, Dubai, Sydney and Toronto — each with
its own currency, price band, amenities and a vision analysis.

These are **fixtures, not real properties**: titles, addresses and vision scores are
invented, and the "photos" are generated gradients labelled with the city.

The images are uploaded separately because they are binary assets, not rows:

```bash
npm run seed:photos     # writes gradient covers into the property-photos bucket
```

Without that step the listings still exist (and are searchable) but show "No photo yet".
The script is idempotent — it upserts, so re-running is harmless.

### Bookings and payments

The flow is deliberately boring:

1. `POST /api/bookings/quote` prices the stay and reports availability. The quote is
   advisory — the server re-prices when the booking is created.
2. `POST /api/bookings` inserts an unpaid booking in `pending_payment`, which **holds the
   dates**, then starts Stripe Checkout.
3. `POST /api/webhooks/stripe` verifies the signature, claims the event (unique
   `provider + event_id`), confirms the booking and creates its payout record.
4. Cancelling computes the refund from the booking's policy snapshot and asks Stripe to
   move that exact amount.

Three rules worth knowing:

- **The database decides who wins a race.** `bookings` has a GiST exclusion constraint on
  `daterange(checkin, checkout, '[)')` covering live states *and unpaid holds*. Ten
  simultaneous attempts at the same dates produce exactly one reservation; the other nine
  fail with `23P01`. This is covered by `tests/concurrency.test.ts`.
- **Holds expire.** An abandoned checkout would otherwise block dates forever, so
  `expire_stale_pending_bookings()` cancels unpaid bookings older than 15 minutes. It is
  called opportunistically by the booking API; schedule it later if you like.
- **Cancellation terms are frozen at booking time.** Policy key, version and rules are
  snapshotted onto the row, so editing `CANCELLATION_POLICIES` never rewrites old bookings.

Payouts are split per `platform_settings.revenue_split` (82 / 15 / 3), computed in integer
minor units with the owner taking the remainder so the three amounts always reconcile.

**Payout release.** Owners and hosts onboard through Stripe Connect from the Payouts page
(`POST /api/connect/onboard` creates the Express account once and stores its id on the
profile). A worker then pays whatever is due:

```bash
curl -X POST localhost:3000/api/internal/payouts/release \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN"
```

Each payout gets at most one transfer per slot, keyed `booking:<id>:owner` /
`booking:<id>:host` and grouped by `booking:<id>`. Before retrying, the worker lists
transfers in that group and reuses the existing one, so a crashed run cannot pay twice. A
missing or unverified Connect account leaves the payout `releasable` with a reason instead
of failing silently.

**Lifecycle.** Trips move on by their dates — `confirmed → checked_in → checked_out →
completed` — via a second worker:

```bash
curl -X POST localhost:3000/api/internal/bookings/advance \
  -H "Authorization: Bearer $INTERNAL_API_TOKEN"
```

Both endpoints are idempotent, so run them from cron/n8n as often as you like.

**Availability.** Owners block dates on the property edit page; the quote endpoint and the
booking conflict check both honour them, and the database rejects overlapping blocks.

**Development without Stripe.** If `STRIPE_SECRET_KEY` is unset and you are not in
production, the booking is confirmed immediately and the response and UI both say so
("Development mode: no payment was taken"). In production the hold is released and the
request returns 503 — a booking nobody paid for must never keep dates blocked.

To exercise the real path, add test keys and forward webhooks:

```bash
# .env.local
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

### Tests

Unit suites (`money`, `pricing`, `bookings`, `payouts`, `ai-validation`, `rate-limit`,
`storage`) run anywhere, no infrastructure needed:

```bash
npx vitest run tests/money.test.ts tests/pricing.test.ts tests/bookings.test.ts \
               tests/payouts.test.ts tests/ai-validation.test.ts \
               tests/rate-limit.test.ts tests/storage.test.ts
```

`tests/rls.test.ts`, `tests/concurrency.test.ts` and `tests/release.test.ts` are
**integration** suites: they need a running local Supabase with seed data
(`supabase start && supabase db reset`) and will fail without one. `npm test` runs
everything. The release suite uses a fake Connect port, so it never calls Stripe.

---

## Architecture

```
app/
  core/              Domain layer — no framework, no vendor imports
    entities/        Row types + enums, mirroring supabase/migrations/0001
    usecases/        property create/analyze, booking create/confirm/cancel, stripe events
  lib/
    ai/              provider (transport) → structured (aiJson boundary) → vision (task)
    bookings/        Quote, state machine, lifecycle, cancellation, settlement
    payments/        Payout release rules, Connect port (transfers, onboarding)
    pricing/         Deterministic refinements; money computed here, never by a model
    storage/         Upload validation, sharp re-encode, signed URL minting
    supabase/        Browser / server / service clients + session middleware
    money.ts         Integer minor-unit parsing and formatting
    authorization.ts requireUser / requireRole for route handlers
    rate-limit.ts    Postgres-backed, fixed-window
  api/               Route handlers (properties, bookings, uploads, webhooks, connect,
                     internal schedulers)
  property/[id]/     Public detail page
  book/[propertyId]/ Date selection, live quote, reserve
  bookings/[id]/     Trip detail, policy, cancellation
  search/            Public discovery
infrastructure/      Adapters implementing the ports the core depends on
mcp-server/          Read-only MCP server exposing this data to Claude over stdio
                     (see mcp-server/README.md)
legacy/              Earlier prototype (Firebase). Excluded from build, lint and tsc.
                     Kept for reference only — do not import from it.
```

**Dependency rule:** `core` → `lib/ai/port` interfaces; `infrastructure` implements them.
Nothing in `core` imports a vendor SDK.

### Database

Thirteen migrations in `supabase/migrations/`, applied in order:

`0001` schema (21 tables, enums, constraints) · `0002` RLS policies · `0003` safe mutation
RPCs · `0004` private storage buckets · `0005` dev seed · `0006` grants · `0007` review FK ·
`0008` vision config · `0009` storage object policies · `0010` public profile view ·
`0011` rate limits · `0012` placeholder cities · `0013` booking holds + expiry.

Money columns are `bigint` minor units. `properties` enforces
`min_price <= base_price <= max_price`, and `bookings` enforces non-overlap for live
stays in the database itself.

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
- **MCP access is a separate, read-only key.** `/api/mcp/*` exposes fixed queries (no
  arbitrary SQL) behind a constant-time bearer check; there are no write tools, so a
  prompt-injected tool call cannot move money.
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
