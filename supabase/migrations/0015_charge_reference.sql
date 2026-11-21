-- HYDRASCAPES v5
-- 0015_charge_reference.sql
--
-- Stripe plan review #9: keep the charge id on the booking so transfers can use
-- `source_transaction`. Without it a transfer fails when the platform balance is
-- short, and Stripe does not retry failed transfers; with it, Stripe holds the
-- transfer until that charge's funds are actually available.
--
-- It is also the lookup key for dispute and early-fraud-warning webhooks, which
-- freeze the payout (plan review #12).

begin;

alter table public.bookings
  add column if not exists stripe_charge_id text;

comment on column public.bookings.stripe_charge_id is
  'Charge created by the payment provider for this booking. Used as the '
  'transfer source_transaction and to match dispute webhooks.';

create index if not exists bookings_charge_idx
  on public.bookings(stripe_charge_id)
  where stripe_charge_id is not null;

commit;
