-- HYDRASCAPES v5
-- 0014_payout_financials.sql
--
-- Phase 3 follow-up (Stripe plan review).
--
-- 1. Processing fees. The revenue split previously divided the gross charge
--    82/15/3, but Stripe's processing fee is debited from the platform balance,
--    so a 3% platform share could be entirely consumed (or negative) on small
--    bookings. The fee is now estimated before splitting, so the three shares
--    divide what is actually distributable and the cost is visible.
--
-- 2. Reversals. If a booking is cancelled after its payout has been
--    transferred, the refund must be clawed back from the payees. These
--    columns record how much was reversed from each slot, for audit.

begin;

alter table public.payouts
  add column if not exists processing_fee_minor bigint not null default 0
    check (processing_fee_minor >= 0),
  add column if not exists reversed_owner_minor bigint not null default 0
    check (reversed_owner_minor >= 0),
  add column if not exists reversed_host_minor bigint not null default 0
    check (reversed_host_minor >= 0),
  add column if not exists reversal_reference jsonb not null default '{}'::jsonb;

comment on column public.payouts.processing_fee_minor is
  'Estimated Stripe processing cost, deducted from the charge before the revenue '
  'split. gross = settlement_base_minor + processing_fee_minor.';
comment on column public.payouts.reversed_owner_minor is
  'Amount clawed back from the owner transfer after a post-release refund.';
comment on column public.payouts.reversal_reference is
  'Stripe reversal ids keyed by slot, for auditing and safe retries.';

-- Releasable_at ordering is the worker's hot query.
create index if not exists payouts_due_idx
  on public.payouts(status, releasable_at);

-- Fee assumptions live in configuration, not code. bps of the charge plus a
-- fixed minor-unit component; override per deployment as your real rates firm up.
insert into public.platform_settings (key, value_json, description)
values (
  'processing_fees',
  '{"bps": 290, "fixed_minor": 30}'::jsonb,
  'Estimated Stripe processing fee: basis points of the charge plus fixed minor '
  'units. Deducted before the owner/host/platform split.'
)
on conflict (key) do nothing;

commit;
