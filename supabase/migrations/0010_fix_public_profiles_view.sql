-- HYDRASCAPES v5
-- 0010_fix_public_profiles_view.sql
--
-- `public.public_profiles` was created with `security_invoker = true`, so a
-- query against it ran with the *caller's* privileges and hit `profiles` RLS,
-- which is self-or-admin only. Result: anonymous and other-authenticated
-- visitors got zero rows from a view whose entire purpose is public identity
-- (spec §6 "create a limited public profile view").
--
-- The view exposes only six non-sensitive columns, so it is safe to run it
-- with the owner's (definer) privileges. `profiles` itself stays locked down.

begin;

alter view public.public_profiles set (security_invoker = false);

comment on view public.public_profiles is
  'Public identity projection. Runs with definer privileges so anonymous '
  'visitors can read exactly these six columns; public.profiles remains '
  'restricted to self and admins. Never add email, phone, kyc_status or '
  'Stripe identifiers to this view.';

grant select on public.public_profiles to anon, authenticated;

commit;
