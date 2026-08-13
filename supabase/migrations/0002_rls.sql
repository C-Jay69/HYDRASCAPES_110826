-- NEST v5
-- 0002_rls.sql
--
-- Principle:
-- RLS determines WHICH ROWS a caller can touch.
-- Column privileges / trusted server routes determine WHAT
-- sensitive fields they are allowed to change.

begin;

-- ============================================================
-- ENABLE RLS EVERYWHERE
-- ============================================================

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.availability_blocks enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_inspections enable row level security;
alter table public.host_applications enable row level security;
alter table public.message_threads enable row level security;
alter table public.thread_participants enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;
alter table public.payouts enable row level security;
alter table public.disputes enable row level security;
alter table public.pricing_signals enable row level security;
alter table public.price_suggestions enable row level security;
alter table public.price_calendar enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.property_comps enable row level security;
alter table public.kyc_verifications enable row level security;
alter table public.processed_webhook_events enable row level security;
alter table public.platform_settings enable row level security;
alter table public.audit_logs enable row level security;

-- Force table owners to respect RLS during ordinary testing.
-- Service-role behavior must still be understood separately.

alter table public.profiles force row level security;
alter table public.properties force row level security;
alter table public.availability_blocks force row level security;
alter table public.bookings force row level security;
alter table public.booking_inspections force row level security;
alter table public.host_applications force row level security;
alter table public.message_threads force row level security;
alter table public.thread_participants force row level security;
alter table public.messages force row level security;
alter table public.reviews force row level security;
alter table public.payouts force row level security;
alter table public.disputes force row level security;
alter table public.pricing_signals force row level security;
alter table public.price_suggestions force row level security;
alter table public.price_calendar force row level security;
alter table public.pricing_rules force row level security;
alter table public.property_comps force row level security;
alter table public.kyc_verifications force row level security;
alter table public.processed_webhook_events force row level security;
alter table public.platform_settings force row level security;
alter table public.audit_logs force row level security;

-- ============================================================
-- PROFILES
-- ============================================================

-- A signed-in user sees their complete profile.
create policy profiles_self_select
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Admin server/user sees profiles.
create policy profiles_admin_select
on public.profiles
for select
to authenticated
using (public.is_admin());

-- Do NOT provide a broad self-update policy.
-- Profile edits should use a restricted RPC/server endpoint that only
-- allows safe fields such as full_name, avatar_path, location_json, bio.
--
-- In particular the browser must never directly update:
-- role
-- kyc_status
-- kyc_verified_at
-- stripe_connect_id
-- stripe_customer_id
-- ratings

-- ============================================================
-- PROPERTIES
-- ============================================================

create policy properties_public_select
on public.properties
for select
to anon, authenticated
using (
  status in ('listed', 'managed')
  or owner_id = auth.uid()
  or assigned_host_id = auth.uid()
  or public.is_admin()
);

create policy properties_owner_insert
on public.properties
for insert
to authenticated
with check (
  owner_id = auth.uid()
  and public.current_user_role() = 'owner'
);

-- Deliberately no broad authenticated UPDATE policy.
-- Property mutations go through the property API/server boundary.
--
-- This prevents an owner from directly modifying:
-- assigned_host_id
-- vision_analysis
-- vision_model
-- vision_status
-- moderation-sensitive status
--
-- The server may expose explicitly allowed editable fields.

-- ============================================================
-- AVAILABILITY
-- ============================================================

create policy availability_public_select
on public.availability_blocks
for select
to anon, authenticated
using (true);

create policy availability_manager_insert
on public.availability_blocks
for insert
to authenticated
with check (
  public.manages_property(property_id)
  and created_by = auth.uid()
);

create policy availability_manager_delete
on public.availability_blocks
for delete
to authenticated
using (public.manages_property(property_id));

-- Updates can be modeled as delete + insert, reducing ambiguity.

-- ============================================================
-- BOOKINGS
-- ============================================================

create policy bookings_party_select
on public.bookings
for select
to authenticated
using (
  guest_id = auth.uid()
  or owner_id = auth.uid()
  or host_id = auth.uid()
  or public.is_admin()
);

-- NO client insert.
--
-- Booking creation must go through POST /api/bookings.
-- That endpoint calculates:
-- owner_id
-- host_id
-- nightly price
-- fees
-- taxes
-- total
-- cancellation policy
--
-- The browser must never be allowed to INSERT those values directly.

-- NO client update.
--
-- Booking state, totals, refunds and Stripe IDs are trusted-server only.

-- ============================================================
-- BOOKING INSPECTIONS
-- ============================================================

create policy inspections_party_select
on public.booking_inspections
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and (
        b.guest_id = auth.uid()
        or b.owner_id = auth.uid()
        or b.host_id = auth.uid()
      )
  )
  or public.is_admin()
);

create policy inspections_party_insert
on public.booking_inspections
for insert
to authenticated
with check (
  submitted_by = auth.uid()
  and exists (
    select 1
    from public.bookings b
    where b.id = booking_id
      and (
        b.guest_id = auth.uid()
        or b.owner_id = auth.uid()
        or b.host_id = auth.uid()
      )
      and b.status in (
        'confirmed',
        'checked_in',
        'checked_out'
      )
  )
);

-- Inspection modification/deletion is intentionally restricted.
-- Evidence should not silently change after submission.

-- ============================================================
-- HOST APPLICATIONS
-- ============================================================

create policy applications_visible
on public.host_applications
for select
to authenticated
using (
  host_id = auth.uid()
  or public.owns_property(property_id)
  or public.is_admin()
);

create policy applications_host_insert
on public.host_applications
for insert
to authenticated
with check (
  host_id = auth.uid()
  and public.current_user_role() = 'host'
  and status = 'applied'
  and ai_match_score is null
  and ai_match_reasoning is null
  and ai_model is null
  and ai_scored_at is null
);

-- Withdrawal and owner acceptance/rejection happen through trusted routes.
--
-- This prevents a host from directly changing:
-- status
-- AI score
-- AI reasoning
--
-- It also prevents an owner from assigning themselves arbitrary AI data.

-- ============================================================
-- THREADS / MESSAGES
-- ============================================================

create policy threads_participant_select
on public.message_threads
for select
to authenticated
using (
  public.is_thread_participant(id)
  or public.is_admin()
);

create policy thread_participants_select
on public.thread_participants
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_thread_participant(thread_id)
  or public.is_admin()
);

-- Creation of threads and participant membership happens through server
-- routes after validating the property/booking relationship.
--
-- This prevents a user from adding arbitrary participants.

create policy messages_participant_select
on public.messages
for select
to authenticated
using (
  public.is_thread_participant(thread_id)
  or public.is_admin()
);

create policy messages_participant_insert
on public.messages
for insert
to authenticated
with check (
  sender_id = auth.uid()
  and public.is_thread_participant(thread_id)
);

-- Message editing/deleting is not supported in v1.

-- ============================================================
-- REVIEWS
-- ============================================================

create policy reviews_public_select
on public.reviews
for select
to anon, authenticated
using (true);

-- Review insertion should go through server validation because validating
-- target_id correctly differs for property / host / guest.
--
-- Do not allow arbitrary direct INSERT merely because the caller was part
-- of the booking.

-- ============================================================
-- PAYOUTS
-- ============================================================

create policy payouts_party_select
on public.payouts
for select
to authenticated
using (
  owner_id = auth.uid()
  or host_id = auth.uid()
  or public.is_admin()
);

-- No authenticated INSERT / UPDATE / DELETE policies.
--
-- Payout creation, release, freeze, failure and reconciliation are
-- trusted-server/service operations only.

-- ============================================================
-- DISPUTES
-- ============================================================

create policy disputes_party_select
on public.disputes
for select
to authenticated
using (
  claimant_id = auth.uid()
  or respondent_id = auth.uid()
  or public.is_admin()
);

-- Dispute creation goes through POST /api/disputes.
--
-- Server derives/validates:
-- booking relationship
-- respondent
-- maximum claim
-- applicable dispute window
--
-- AI fields and final decisions are never browser writable.

-- ============================================================
-- PRICING SIGNALS
-- ============================================================

create policy pricing_signals_manager_select
on public.pricing_signals
for select
to authenticated
using (
  public.manages_property(property_id)
  or public.is_admin()
);

-- Signals are machine-written only.

-- ============================================================
-- PRICE SUGGESTIONS
-- ============================================================

create policy price_suggestions_manager_select
on public.price_suggestions
for select
to authenticated
using (
  public.manages_property(property_id)
  or public.is_admin()
);

-- Applying/rejecting suggestions occurs through trusted server logic.
-- No broad browser UPDATE.

-- ============================================================
-- PRICE CALENDAR
-- ============================================================

create policy price_calendar_public_select
on public.price_calendar
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.properties p
    where p.id = property_id
      and (
        p.status in ('listed', 'managed')
        or p.owner_id = auth.uid()
        or p.assigned_host_id = auth.uid()
        or public.is_admin()
      )
  )
);

-- Calendar mutations go through pricing/property server operations.

-- ============================================================
-- PRICING RULES
-- ============================================================

create policy pricing_rules_owner_select
on public.pricing_rules
for select
to authenticated
using (
  public.owns_property(property_id)
  or public.is_admin()
);

-- Owner changes go through API/RPC so updated_by is server-derived and
-- values can be checked against property price bands.

-- ============================================================
-- PROPERTY COMPS
-- ============================================================

create policy property_comps_owner_select
on public.property_comps
for select
to authenticated
using (
  public.owns_property(property_id)
  or public.is_admin()
);

create policy property_comps_owner_insert
on public.property_comps
for insert
to authenticated
with check (
  public.owns_property(property_id)
  and created_by = auth.uid()
);

create policy property_comps_owner_delete
on public.property_comps
for delete
to authenticated
using (
  public.owns_property(property_id)
);

-- Changes may be delete + recreate, or later exposed through safe RPC.

-- ============================================================
-- KYC
-- ============================================================

create policy kyc_self_select
on public.kyc_verifications
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_admin()
);

-- No client writes.
--
-- KYC state comes from verified provider webhook/server operations only.

-- ============================================================
-- WEBHOOK EVENTS
-- ============================================================

-- Intentionally NO policies for normal clients.
--
-- Only trusted backend/service operations should access this table.

-- ============================================================
-- PLATFORM SETTINGS
-- ============================================================

create policy platform_settings_admin_select
on public.platform_settings
for select
to authenticated
using (public.is_admin());

-- No browser writes in v1.
-- Admin changes should use audited server routes.

-- ============================================================
-- AUDIT LOG
-- ============================================================

create policy audit_admin_select
on public.audit_logs
for select
to authenticated
using (public.is_admin());

-- No client insert/update/delete.
-- Trusted server/service operations write audit rows.

commit;