-- HYDRASCAPES v5
-- 0001_init.sql
--
-- Core schema.
-- Security policies are intentionally separated into 0002_rls.sql.
--
-- IMPORTANT:
-- Money columns use integer minor units.
-- Example: USD 123.45 = 12345.
-- This avoids floating-point settlement errors.

begin;

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

-- ============================================================
-- ENUMS
-- ============================================================

create type public.user_role as enum (
  'owner',
  'host',
  'guest',
  'admin'
);

create type public.kyc_state as enum (
  'none',
  'pending',
  'verified',
  'rejected',
  'expired'
);

create type public.property_state as enum (
  'draft',
  'listed',
  'pending_host',
  'managed',
  'suspended'
);

create type public.vision_state as enum (
  'pending',
  'processing',
  'complete',
  'failed',
  'stale'
);

create type public.application_state as enum (
  'applied',
  'accepted',
  'rejected',
  'withdrawn'
);

create type public.booking_state as enum (
  'pending_payment',
  'reserved',
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
  'refunded'
);

create type public.payout_state as enum (
  'held',
  'releasable',
  'released',
  'failed',
  'frozen'
);

create type public.dispute_state as enum (
  'open',
  'under_review',
  'resolved',
  'withdrawn'
);

create type public.webhook_processing_state as enum (
  'processing',
  'processed',
  'failed'
);

-- ============================================================
-- COMMON FUNCTIONS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- PROFILES
-- ============================================================

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,

  email text unique not null,
  role public.user_role not null default 'guest',

  full_name text not null,
  avatar_path text,
  location_json jsonb not null default '{}'::jsonb,
  bio text,

  rating_avg numeric(3,2)
    check (rating_avg is null or rating_avg between 1 and 5),

  rating_count integer not null default 0
    check (rating_count >= 0),

  kyc_status public.kyc_state not null default 'none',
  kyc_verified_at timestamptz,

  stripe_connect_id text unique,
  stripe_customer_id text unique,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Prevent signup metadata from creating an administrator.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_role text;
  safe_role public.user_role;
begin
  requested_role := lower(
    coalesce(new.raw_user_meta_data ->> 'role', 'guest')
  );

  if requested_role in ('owner', 'host', 'guest') then
    safe_role := requested_role::public.user_role;
  else
    safe_role := 'guest';
  end if;

  insert into public.profiles (
    id,
    email,
    full_name,
    role
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      split_part(coalesce(new.email, ''), '@', 1),
      'Nest user'
    ),
    safe_role
  );

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============================================================
-- AUTHORIZATION HELPERS
-- ============================================================

create or replace function public.current_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.role = 'admin'
      from public.profiles p
      where p.id = auth.uid()
    ),
    false
  )
$$;

-- ============================================================
-- PROPERTIES
-- ============================================================

create table public.properties (
  id uuid primary key default gen_random_uuid(),

  owner_id uuid not null
    references public.profiles(id)
    on delete cascade,

  assigned_host_id uuid
    references public.profiles(id)
    on delete set null,

  title text not null
    check (char_length(title) between 3 and 140),

  description text,

  address_json jsonb not null default '{}'::jsonb,

  latitude double precision
    check (latitude is null or latitude between -90 and 90),

  longitude double precision
    check (longitude is null or longitude between -180 and 180),

  bedrooms integer not null default 1
    check (bedrooms >= 0 and bedrooms <= 100),

  bathrooms numeric(4,1) not null default 1
    check (bathrooms >= 0 and bathrooms <= 100),

  max_guests integer not null default 2
    check (max_guests >= 1 and max_guests <= 100),

  amenities text[] not null default '{}',

  -- Integer minor currency units.
  base_price_minor bigint not null
    check (base_price_minor > 0),

  min_price_minor bigint not null
    check (min_price_minor > 0),

  max_price_minor bigint not null
    check (max_price_minor > 0),

  currency char(3) not null default 'USD'
    check (currency = upper(currency)),

  cleaning_fee_minor bigint not null default 0
    check (cleaning_fee_minor >= 0),

  status public.property_state not null default 'draft',

  -- Storage object paths, never signed/public URLs.
  photos text[] not null default '{}',
  cover_photo text,

  vision_analysis jsonb not null default '{}'::jsonb,
  vision_status public.vision_state not null default 'pending',
  vision_analyzed_at timestamptz,
  vision_model text,
  vision_schema_version integer,
  vision_photos_hash text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint properties_price_band_check
    check (
      min_price_minor <= base_price_minor
      and base_price_minor <= max_price_minor
    )
);

create index properties_owner_idx
  on public.properties(owner_id);

create index properties_assigned_host_idx
  on public.properties(assigned_host_id);

create index properties_public_status_idx
  on public.properties(status)
  where status in ('listed', 'managed');

create index properties_amenities_idx
  on public.properties using gin(amenities);

create index properties_vision_idx
  on public.properties
  using gin(vision_analysis jsonb_path_ops);

create trigger properties_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

create or replace function public.owns_property(property_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.properties p
    where p.id = property_uuid
      and p.owner_id = auth.uid()
  )
$$;

create or replace function public.manages_property(property_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.properties p
    where p.id = property_uuid
      and (
        p.owner_id = auth.uid()
        or p.assigned_host_id = auth.uid()
      )
  )
$$;

-- ============================================================
-- AVAILABILITY
-- ============================================================

create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),

  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  start_date date not null,
  end_date date not null,

  reason text,

  created_by uuid
    references public.profiles(id)
    on delete set null,

  created_at timestamptz not null default now(),

  check (end_date > start_date),

  constraint availability_no_overlap
  exclude using gist (
    property_id with =,
    daterange(start_date, end_date, '[)') with &&
  )
);

create index availability_property_idx
  on public.availability_blocks(property_id, start_date);

-- ============================================================
-- BOOKINGS
-- ============================================================

create table public.bookings (
  id uuid primary key default gen_random_uuid(),

  property_id uuid not null
    references public.properties(id)
    on delete restrict,

  guest_id uuid not null
    references public.profiles(id)
    on delete restrict,

  host_id uuid
    references public.profiles(id)
    on delete set null,

  owner_id uuid not null
    references public.profiles(id)
    on delete restrict,

  checkin date not null,
  checkout date not null,

  nights integer generated always as (checkout - checkin) stored,

  guests_count integer not null default 1
    check (guests_count > 0),

  per_night_rate_minor bigint not null
    check (per_night_rate_minor >= 0),

  nightly_subtotal_minor bigint not null
    check (nightly_subtotal_minor >= 0),

  cleaning_fee_minor bigint not null default 0
    check (cleaning_fee_minor >= 0),

  taxes_minor bigint not null default 0
    check (taxes_minor >= 0),

  total_amount_minor bigint not null
    check (total_amount_minor >= 0),

  currency char(3) not null
    check (currency = upper(currency)),

  status public.booking_state not null default 'pending_payment',

  stripe_payment_intent_id text unique,

  cancellation_policy_key text not null,
  cancellation_policy_version integer not null,

  cancellation_policy_snapshot jsonb not null default '{}'::jsonb,

  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),

  refund_amount_minor bigint
    check (
      refund_amount_minor is null
      or refund_amount_minor >= 0
    ),

  guest_preferences jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  check (checkout > checkin),

  constraint booking_refund_not_above_total
    check (
      refund_amount_minor is null
      or refund_amount_minor <= total_amount_minor
    ),

  constraint no_double_booking
  exclude using gist (
    property_id with =,
    daterange(checkin, checkout, '[)') with &&
  )
  where (
    status in (
      'reserved',
      'confirmed',
      'checked_in',
      'checked_out',
      'completed'
    )
  )
);

create index bookings_property_date_idx
  on public.bookings(property_id, checkin);

create index bookings_guest_idx
  on public.bookings(guest_id, created_at desc);

create index bookings_owner_idx
  on public.bookings(owner_id, created_at desc);

create index bookings_host_idx
  on public.bookings(host_id, created_at desc);

create index bookings_status_idx
  on public.bookings(status);

create trigger bookings_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

-- ============================================================
-- BOOKING INSPECTIONS
-- ============================================================

create table public.booking_inspections (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings(id)
    on delete cascade,

  kind text not null
    check (kind in ('check_in', 'check_out')),

  photos text[] not null default '{}',
  notes text,

  submitted_by uuid not null
    references public.profiles(id)
    on delete restrict,

  submitted_at timestamptz not null default now(),

  unique (booking_id, kind)
);

create index booking_inspections_booking_idx
  on public.booking_inspections(booking_id);

-- ============================================================
-- HOST APPLICATIONS
-- ============================================================

create table public.host_applications (
  id uuid primary key default gen_random_uuid(),

  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  host_id uuid not null
    references public.profiles(id)
    on delete cascade,

  status public.application_state not null default 'applied',

  proposed_fee_pct numeric(5,2) not null
    check (proposed_fee_pct between 0 and 50),

  pitch_text text,

  ai_match_score numeric(5,2)
    check (
      ai_match_score is null
      or ai_match_score between 0 and 100
    ),

  ai_match_reasoning text,
  ai_model text,
  ai_scored_at timestamptz,

  created_at timestamptz not null default now(),
  responded_at timestamptz,

  unique (property_id, host_id)
);

create index host_applications_property_idx
  on public.host_applications(property_id, created_at desc);

create index host_applications_host_idx
  on public.host_applications(host_id, created_at desc);

-- Database-level KYC enforcement.
create or replace function public.enforce_host_application_kyc()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.host_id <> auth.uid()
     and auth.role() <> 'service_role' then
    raise exception 'HOST_ID_MISMATCH'
      using errcode = 'P0001';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = new.host_id
      and p.role = 'host'
      and p.kyc_status = 'verified'
  ) then
    raise exception 'HOST_NOT_VERIFIED'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger host_application_requires_kyc
before insert on public.host_applications
for each row execute function public.enforce_host_application_kyc();

-- ============================================================
-- MESSAGING
-- ============================================================

create table public.message_threads (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid
    references public.bookings(id)
    on delete set null,

  property_id uuid
    references public.properties(id)
    on delete set null,

  subject text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger message_threads_updated_at
before update on public.message_threads
for each row execute function public.set_updated_at();

create table public.thread_participants (
  thread_id uuid not null
    references public.message_threads(id)
    on delete cascade,

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  last_read_at timestamptz,

  primary key (thread_id, user_id)
);

create index thread_participants_user_idx
  on public.thread_participants(user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),

  thread_id uuid not null
    references public.message_threads(id)
    on delete cascade,

  sender_id uuid not null
    references public.profiles(id)
    on delete cascade,

  content text not null
    check (char_length(content) between 1 and 5000),

  media_path text,

  created_at timestamptz not null default now()
);

create index messages_thread_created_idx
  on public.messages(thread_id, created_at desc);

create or replace function public.is_thread_participant(thread_uuid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.thread_participants tp
    where tp.thread_id = thread_uuid
      and tp.user_id = auth.uid()
  )
$$;

-- ============================================================
-- REVIEWS
-- ============================================================

create table public.reviews (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings(id)
    on delete cascade,

  reviewer_id uuid not null
    references public.profiles(id)
    on delete cascade,

  target_type text not null
    check (target_type in ('property', 'host', 'guest')),

  target_id uuid not null,

  rating integer not null
    check (rating between 1 and 5),

  comment text,

  created_at timestamptz not null default now(),

  unique (booking_id, reviewer_id, target_type)
);

create index reviews_booking_idx
  on public.reviews(booking_id);

-- ============================================================
-- PAYOUTS
-- ============================================================

create table public.payouts (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null unique
    references public.bookings(id)
    on delete restrict,

  owner_id uuid not null
    references public.profiles(id)
    on delete restrict,

  host_id uuid
    references public.profiles(id)
    on delete restrict,

  -- Amount being distributed among owner/host/platform.
  settlement_base_minor bigint not null
    check (settlement_base_minor >= 0),

  owner_amount_minor bigint not null
    check (owner_amount_minor >= 0),

  host_amount_minor bigint not null default 0
    check (host_amount_minor >= 0),

  platform_amount_minor bigint not null
    check (platform_amount_minor >= 0),

  owner_pct_snapshot numeric(7,4) not null
    check (owner_pct_snapshot between 0 and 100),

  host_pct_snapshot numeric(7,4) not null
    check (host_pct_snapshot between 0 and 100),

  platform_pct_snapshot numeric(7,4) not null
    check (platform_pct_snapshot between 0 and 100),

  currency char(3) not null
    check (currency = upper(currency)),

  status public.payout_state not null default 'held',

  releasable_at timestamptz not null,

  stripe_transfer_owner_id text unique,
  stripe_transfer_host_id text unique,

  failure_reason text,

  released_at timestamptz,
  created_at timestamptz not null default now(),

  constraint payout_amounts_reconcile
    check (
      owner_amount_minor
      + host_amount_minor
      + platform_amount_minor
      = settlement_base_minor
    ),

  constraint payout_percentage_snapshot_sane
    check (
      round(
        owner_pct_snapshot
        + host_pct_snapshot
        + platform_pct_snapshot,
        4
      ) = 100.0000
    )
);

create index payouts_status_releasable_idx
  on public.payouts(status, releasable_at);

create index payouts_owner_idx
  on public.payouts(owner_id);

create index payouts_host_idx
  on public.payouts(host_id);

-- ============================================================
-- DISPUTES
-- ============================================================

create table public.disputes (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null
    references public.bookings(id)
    on delete cascade,

  claimant_id uuid not null
    references public.profiles(id)
    on delete restrict,

  respondent_id uuid not null
    references public.profiles(id)
    on delete restrict,

  amount_claimed_minor bigint not null
    check (amount_claimed_minor >= 0),

  description text not null
    check (char_length(description) between 1 and 10000),

  status public.dispute_state not null default 'open',

  ai_assessment jsonb,
  ai_model text,
  ai_assessed_at timestamptz,

  admin_decision text,

  admin_award_claimant_minor bigint
    check (
      admin_award_claimant_minor is null
      or admin_award_claimant_minor >= 0
    ),

  resolved_by uuid
    references public.profiles(id)
    on delete set null,

  resolved_at timestamptz,

  created_at timestamptz not null default now()
);

create index disputes_booking_idx
  on public.disputes(booking_id);

create index disputes_open_idx
  on public.disputes(status, created_at)
  where status in ('open', 'under_review');

create or replace function public.freeze_payout_on_dispute()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payouts
  set status = 'frozen'
  where booking_id = new.booking_id
    and status in ('held', 'releasable');

  return new;
end;
$$;

create trigger dispute_freezes_payout
after insert on public.disputes
for each row execute function public.freeze_payout_on_dispute();

-- ============================================================
-- PRICING
-- ============================================================

create table public.pricing_signals (
  id bigint generated always as identity primary key,

  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  signal_date date not null,

  signal_type text not null,

  value_decimal numeric(18,6),
  value_text text,
  value_json jsonb,

  confidence real
    check (confidence is null or confidence between 0 and 1),

  collected_at timestamptz not null default now(),

  unique (property_id, signal_date, signal_type)
);

create index pricing_signals_property_idx
  on public.pricing_signals(property_id, signal_date desc);

create table public.price_suggestions (
  id bigint generated always as identity primary key,

  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  stay_date date not null,

  current_price_minor bigint not null
    check (current_price_minor >= 0),

  suggested_price_minor bigint not null
    check (suggested_price_minor >= 0),

  price_low_minor bigint not null
    check (price_low_minor >= 0),

  price_high_minor bigint not null
    check (price_high_minor >= 0),

  confidence text not null
    check (confidence in ('low', 'medium', 'high')),

  reasoning_trace jsonb not null,
  multipliers jsonb not null,

  model text,

  status text not null default 'pending'
    check (
      status in (
        'pending',
        'applied',
        'rejected',
        'superseded'
      )
    ),

  applied_at timestamptz,
  applied_by uuid references public.profiles(id),

  created_at timestamptz not null default now(),

  constraint price_suggestion_range
    check (
      price_low_minor
      <= suggested_price_minor
      and suggested_price_minor
      <= price_high_minor
    )
);

create index price_suggestions_pending_idx
  on public.price_suggestions(property_id, stay_date)
  where status = 'pending';

create table public.price_calendar (
  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  stay_date date not null,

  price_minor bigint not null
    check (price_minor > 0),

  source text not null
    check (source in ('base', 'manual', 'ai_applied')),

  updated_at timestamptz not null default now(),

  primary key (property_id, stay_date)
);

create table public.pricing_rules (
  property_id uuid primary key
    references public.properties(id)
    on delete cascade,

  auto_apply boolean not null default false,

  auto_apply_threshold_pct numeric(6,2) not null default 15
    check (auto_apply_threshold_pct between 0 and 100),

  enable_event_pricing boolean not null default true,
  enable_seasonality boolean not null default true,
  enable_vision_adjust boolean not null default true,
  enable_weather boolean not null default true,

  floor_price_minor bigint
    check (floor_price_minor is null or floor_price_minor > 0),

  ceiling_price_minor bigint
    check (ceiling_price_minor is null or ceiling_price_minor > 0),

  updated_by uuid references public.profiles(id),

  updated_at timestamptz not null default now(),

  check (
    floor_price_minor is null
    or ceiling_price_minor is null
    or floor_price_minor <= ceiling_price_minor
  )
);

create trigger pricing_rules_updated_at
before update on public.pricing_rules
for each row execute function public.set_updated_at();

create table public.property_comps (
  id uuid primary key default gen_random_uuid(),

  property_id uuid not null
    references public.properties(id)
    on delete cascade,

  url text,
  bedrooms integer check (bedrooms is null or bedrooms >= 0),

  observed_rate_minor bigint not null
    check (observed_rate_minor > 0),

  currency char(3) not null
    check (currency = upper(currency)),

  observed_on date not null,

  notes text,

  created_by uuid not null
    references public.profiles(id)
    on delete restrict,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index property_comps_property_idx
  on public.property_comps(property_id);

create trigger property_comps_updated_at
before update on public.property_comps
for each row execute function public.set_updated_at();

-- ============================================================
-- KYC
-- ============================================================

create table public.kyc_verifications (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null
    references public.profiles(id)
    on delete cascade,

  provider text not null,
  provider_session_id text unique,

  status public.kyc_state not null default 'pending',

  document_type text,
  selfie_match boolean,
  address_verified boolean,

  failure_code text,

  admin_review_notes text,

  reviewed_by uuid
    references public.profiles(id)
    on delete set null,

  verified_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kyc_user_idx
  on public.kyc_verifications(user_id, created_at desc);

create trigger kyc_updated_at
before update on public.kyc_verifications
for each row execute function public.set_updated_at();

-- ============================================================
-- WEBHOOK IDEMPOTENCY
-- ============================================================

create table public.processed_webhook_events (
  id bigint generated always as identity primary key,

  provider text not null,
  event_id text not null,
  event_type text not null,

  payload_hash text,

  processing_status public.webhook_processing_state
    not null default 'processing',

  error_code text,

  created_at timestamptz not null default now(),
  processed_at timestamptz,

  unique (provider, event_id)
);

create index webhook_status_idx
  on public.processed_webhook_events(
    provider,
    processing_status,
    created_at
  );

-- ============================================================
-- PLATFORM SETTINGS
-- ============================================================

create table public.platform_settings (
  key text primary key,
  value_json jsonb not null,
  description text,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);

-- Seed policy defaults.
-- These are configurable product defaults, not architectural truth.

insert into public.platform_settings (
  key,
  value_json,
  description
)
values
(
  'revenue_split',
  '{"owner_pct":82,"host_pct":15,"platform_pct":3}'::jsonb,
  'Default marketplace settlement split. Snapshot onto each payout.'
),
(
  'payout_policy',
  '{"release_hours_after_checkout":24}'::jsonb,
  'Default delayed payout timing.'
),
(
  'pricing_ai_limits',
  '{"ai_max_adjustment_pct":15,"vision_max_contribution_pct":30}'::jsonb,
  'Maximum configured AI and vision pricing influence.'
)
on conflict (key) do nothing;

-- ============================================================
-- AUDIT LOG
-- ============================================================

create table public.audit_logs (
  id bigint generated always as identity primary key,

  actor_id uuid
    references public.profiles(id)
    on delete set null,

  action text not null,

  entity_type text,
  entity_id uuid,

  old_values jsonb,
  new_values jsonb,

  request_id text,
  ip_address inet,
  user_agent text,

  created_at timestamptz not null default now()
);

create index audit_entity_idx
  on public.audit_logs(
    entity_type,
    entity_id,
    created_at desc
  );

create index audit_actor_idx
  on public.audit_logs(
    actor_id,
    created_at desc
  );

-- ============================================================
-- PUBLIC PROFILE VIEW
-- ============================================================

-- Do not expose profiles directly to anonymous/public users.

create view public.public_profiles
with (security_invoker = true)
as
select
  id,
  full_name,
  avatar_path,
  bio,
  rating_avg,
  rating_count,
  case
    when kyc_status = 'verified' then true
    else false
  end as identity_verified
from public.profiles;

commit;