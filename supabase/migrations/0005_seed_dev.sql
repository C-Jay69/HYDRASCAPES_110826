-- HYDRASCAPES v5
-- 0005_seed_dev.sql
--
-- Development/demo seed data.
-- All users below share the password: "password"
-- (bcrypt hash: $2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2)
--
-- NOTE: profiles are created by the handle_new_user() trigger.
-- The admin profile role is elevated after creation because the trigger
-- intentionally blocks admin at signup.

begin;

-- ============================================================
-- AUTH USERS (development identities)
-- ============================================================

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change_token_new,
  email_change_token_current,
  email_change,
  phone_change,
  phone_change_token,
  reauthentication_token,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'alice@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"owner","full_name":"Alice Owner"}',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000002',
  'authenticated',
  'authenticated',
  'bob@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"owner","full_name":"Bob Owner"}',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000003',
  'authenticated',
  'authenticated',
  'hannah@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"host","full_name":"Hannah Host"}',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000004',
  'authenticated',
  'authenticated',
  'george@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"guest","full_name":"George Guest"}',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000005',
  'authenticated',
  'authenticated',
  'grace@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"guest","full_name":"Grace Guest"}',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000006',
  'authenticated',
  'authenticated',
  'adam@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"guest","full_name":"Adam Admin"}',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000007',
  'authenticated',
  'authenticated',
  'sarah@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"owner","full_name":"Sarah Jenkins"}',
  now(),
  now()
),
(
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000008',
  'authenticated',
  'authenticated',
  'elena@nest.test',
  '$2b$10$B1exh9dcJg922hOKgzXzsOzGKVukIbUuCgT7n5rIzZgnuAvoOM.n2',
  now(),
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}',
  '{"role":"host","full_name":"Elena Rostova"}',
  now(),
  now()
)
on conflict (id) do nothing;

-- ============================================================
-- PROFILE ELEVATIONS
-- ============================================================

-- Elevate the verified host's KYC status (simulates a completed
-- provider verification; normally this happens via webhook).
update public.profiles
set
  kyc_status = 'verified',
  kyc_verified_at = now(),
  updated_at = now()
where id in (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000008'
);

-- Adam was created as guest (trigger blocks admin at signup).
-- Elevation to admin is done here as the trusted operator.
update public.profiles
set
  role = 'admin',
  updated_at = now()
where id = '00000000-0000-0000-0000-000000000006';

-- ============================================================
-- PROPERTIES
-- ============================================================

insert into public.properties (
  id,
  owner_id,
  assigned_host_id,
  title,
  description,
  address_json,
  latitude,
  longitude,
  bedrooms,
  bathrooms,
  max_guests,
  amenities,
  base_price_minor,
  min_price_minor,
  max_price_minor,
  currency,
  cleaning_fee_minor,
  status,
  photos,
  cover_photo,
  vision_status,
  vision_analyzed_at,
  vision_model,
  vision_schema_version,
  vision_photos_hash,
  vision_analysis
)
values
(
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008',
  'The Grand Bay Architectural Villa',
  'An iconic modern villa overlooking San Francisco Bay with floor-to-ceiling glass, radiant heated floors, a chef''s kitchen, and a private infinity spa deck.',
  '{"address":"1420 Montgomery St","city":"San Francisco","state":"CA","zipCode":"94133","country":"USA"}',
  37.7989,
  -122.4042,
  4,
  3.5,
  8,
  array['Ocean View','Private Hot Tub','Chef Kitchen','EV Charger','High-Speed WiFi','Wine Cellar','Sauna'],
  65000,
  45000,
  120000,
  'USD',
  22000,
  'managed',
  array[
    'properties/10000000-0000-0000-0000-000000000001/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000001/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000001/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"luxury","condition_score":9,"interior_modernity_score":10,"curb_appeal_score":9,"notable_features":["Floor-to-ceiling glass facade","Panoramic bay view","Marble waterfall island","Custom lighting design"],"red_flags":[],"aesthetic_vibe":"modern_minimalist","estimated_size_bracket":"spacious","lighting_quality":"exceptional","visual_justification":"High contrast architectural geometry with natural ambient sunlight and premium materials.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000007',
  NULL,
  'SoHo Designer Penthouse Loft',
  'Cast-iron building penthouse with private key elevator, 14ft ceilings, exposed brick, skylights, and lush rooftop garden.',
  '{"address":"480 Broome St","city":"New York","state":"NY","zipCode":"10013","country":"USA"}',
  40.7233,
  -74.0030,
  2,
  2.0,
  4,
  array['Private Elevator','Private Rooftop Garden','Exposed Brick','14ft Ceilings','Sonos','Chef Stove'],
  52000,
  38000,
  95000,
  'USD',
  18000,
  'pending_host',
  array[
    'properties/10000000-0000-0000-0000-000000000002/cover.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000002/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"premium","condition_score":9,"interior_modernity_score":9,"curb_appeal_score":8,"notable_features":["Exposed original brick","Skylights","Private planted rooftop terrace"],"red_flags":[],"aesthetic_vibe":"urban_industrial","estimated_size_bracket":"medium","lighting_quality":"exceptional","visual_justification":"Classic SoHo architectural heritage with contemporary art and lighting.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'Alice Draft Cottage',
  'A private draft listing used for RLS authorization tests.',
  '{"city":"Palo Alto","state":"CA","country":"USA"}',
  37.4442,
  -122.1595,
  2,
  1.0,
  4,
  array['WiFi'],
  25000,
  18000,
  45000,
  'USD',
  8000,
  'draft',
  array[]::text[],
  NULL,
  'pending',
  NULL,
  NULL,
  NULL,
  NULL,
  '{}'::jsonb
)
on conflict (id) do nothing;

-- ============================================================
-- PRICING RULES (defaults for seeded properties)
-- ============================================================

insert into public.pricing_rules (
  property_id,
  auto_apply,
  auto_apply_threshold_pct,
  enable_event_pricing,
  enable_seasonality,
  enable_vision_adjust,
  enable_weather,
  floor_price_minor,
  ceiling_price_minor
)
select
  id,
  true,
  15,
  true,
  true,
  true,
  true,
  min_price_minor,
  max_price_minor
from public.properties
on conflict (property_id) do nothing;

-- ============================================================
-- BOOKINGS + PAYOUT
-- ============================================================

insert into public.bookings (
  id,
  property_id,
  guest_id,
  host_id,
  owner_id,
  checkin,
  checkout,
  guests_count,
  per_night_rate_minor,
  nightly_subtotal_minor,
  cleaning_fee_minor,
  taxes_minor,
  total_amount_minor,
  currency,
  status,
  stripe_payment_intent_id,
  cancellation_policy_key,
  cancellation_policy_version,
  cancellation_policy_snapshot
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000007',
  '2026-10-01',
  '2026-10-04',
  2,
  65000,
  195000,
  22000,
  21700,
  238700,
  'USD',
  'completed',
  'pi_test_grand_bay_001',
  'Moderate',
  1,
  '{"name":"Moderate","refund_5d_pct":100,"refund_1d_pct":50}'
);

-- Payout split: owner 82% / host 15% / platform 3% of nightly subtotal.
insert into public.payouts (
  id,
  booking_id,
  owner_id,
  host_id,
  settlement_base_minor,
  owner_amount_minor,
  host_amount_minor,
  platform_amount_minor,
  owner_pct_snapshot,
  host_pct_snapshot,
  platform_pct_snapshot,
  currency,
  status,
  releasable_at,
  released_at
)
values (
  '30000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000008',
  195000,
  159900,
  29250,
  5850,
  82.0000,
  15.0000,
  3.0000,
  'USD',
  'released',
  now() - interval '48 hours',
  now() - interval '24 hours'
);

-- ============================================================
-- HOST APPLICATION (Alice's pending_host property)
-- ============================================================

insert into public.host_applications (
  id,
  property_id,
  host_id,
  status,
  proposed_fee_pct,
  pitch_text,
  created_at
)
values (
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000008',
  'applied',
  15,
  'I manage 5 luxury urban lofts with 99% 5-star ratings and 24/7 guest concierges.',
  now()
);

-- ============================================================
-- REVIEWS
-- ============================================================

insert into public.reviews (
  id,
  booking_id,
  reviewer_id,
  target_type,
  target_id,
  rating,
  comment,
  created_at
)
values (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000004',
  'property',
  '10000000-0000-0000-0000-000000000001',
  5,
  'Spectacular stay! The panoramic Bay views from the infinity spa terrace were unbelievable.',
  now() - interval '5 days'
);

-- ============================================================
-- AUDIT LOGS
-- ============================================================

insert into public.audit_logs (
  actor_id,
  action,
  entity_type,
  entity_id,
  new_values,
  created_at
)
values
(
  '00000000-0000-0000-0000-000000000007',
  'PROPERTY_CREATE',
  'property',
  '10000000-0000-0000-0000-000000000001',
  '{"title":"The Grand Bay Architectural Villa"}',
  now() - interval '10 days'
),
(
  '00000000-0000-0000-0000-000000000006',
  'ADMIN_ROLE_CHANGE',
  'profile',
  '00000000-0000-0000-0000-000000000006',
  '{"role":"admin"}',
  now() - interval '3 days'
);

commit;