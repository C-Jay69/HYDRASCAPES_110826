-- NEST v5
-- 0006_privileges.sql
--
-- Explicit table privileges for the API roles.
--
-- Principle (SPEC Part B / section 32):
--   RLS determines WHICH rows a caller can touch.
--   Table privileges determine WHICH operations are even offered.
--
-- Supabase's newer secure default does not auto-grant to API roles, so we
-- grant exactly the operations our RLS policies are designed to support.

begin;

-- ============================================================
-- ANON — public browsing only
-- ============================================================

grant select
on public.properties,
   public.reviews,
   public.public_profiles
to anon;

-- ============================================================
-- AUTHENTICATED — least privilege
-- ============================================================

-- Read: every application table with a client-facing SELECT policy.
grant select
on public.profiles,
   public.properties,
   public.availability_blocks,
   public.bookings,
   public.booking_inspections,
   public.host_applications,
   public.message_threads,
   public.thread_participants,
   public.messages,
   public.reviews,
   public.payouts,
   public.disputes,
   public.pricing_rules,
   public.price_calendar,
   public.price_suggestions,
   public.property_comps,
   public.kyc_verifications,
   public.audit_logs,
   public.platform_settings,
   public.public_profiles
to authenticated;

-- Write: only tables with a matching INSERT policy (row-level checks still apply).
grant insert
on public.properties,
   public.availability_blocks,
   public.booking_inspections,
   public.host_applications,
   public.messages,
   public.property_comps
to authenticated;

-- Delete: only tables with a matching DELETE policy.
grant delete
on public.availability_blocks,
   public.property_comps
to authenticated;

-- ============================================================
-- SERVICE_ROLE — trusted backend (workers, edge functions, admin)
-- ============================================================

grant select, insert, update, delete
on public.profiles,
   public.properties,
   public.availability_blocks,
   public.bookings,
   public.booking_inspections,
   public.host_applications,
   public.message_threads,
   public.thread_participants,
   public.messages,
   public.reviews,
   public.payouts,
   public.disputes,
   public.pricing_rules,
   public.price_calendar,
   public.price_suggestions,
   public.pricing_signals,
   public.property_comps,
   public.kyc_verifications,
   public.processed_webhook_events,
   public.platform_settings,
   public.audit_logs,
   public.public_profiles
to service_role;

-- Machine-only tables intentionally have NO client grants at all:
--   processed_webhook_events  -> service_role only
--   pricing_signals           -> service_role only
--   audit_logs                -> authenticated SELECT (admin filter via RLS)
--   platform_settings         -> authenticated SELECT (admin filter via RLS)

commit;