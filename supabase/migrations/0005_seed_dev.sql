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
-- ADDITIONAL DEMO PROPERTIES (world cities)
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
  '10000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000007',
  NULL,
  'Parisian Maisonette',
  'Elegant Haussmann-style apartment in the 7th arrondissement, featuring herringbone parquet floors, moldings, and a private balcony with Eiffel Tower views.',
  '{"address":"12 Rue de la Paix","city":"Paris","state":"Ile-de-France","zipCode":"75007","country":"France"}',
  48.8627,
  2.3373,
  3,
  2.5,
  6,
  array['Balcony','Eiffel Tower View','Parquet Floors','Haussmannian Moldings','Doorman','Concierge','Full Kitchen','WiFi'],
  48000,
  35000,
  85000,
  'EUR',
  15000,
  'listed',
  array[
    'properties/10000000-0000-0000-0000-000000000004/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000004/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000004/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"luxury","condition_score":9,"interior_modernity_score":8,"curb_appeal_score":9,"notable_features":[Herringbone parquet floors,Haussmannian moldings,Eiffel Tower view from balcony],"red_flags":[],"aesthetic_vibe":"classic_parisian","estimated_size_bracket":"compact","lighting_quality":"soft natural light","visual_justification":"Timeless Parisian elegance with modern amenities blended seamlessly.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000005',
  '00000000-0000-0000-0000-000000000007',
  NULL,
  'Tokyo Skyline Tower Suite',
  'Luxury suite in a ultra-modern tower with floor-to-ceiling windows, robot butler, and panoramic city views day and night.',
  '{"address":"2-3-1 Shibadai, Minato-ku","city":"Tokyo","state":"Tokyo","zipCode":"108-0070","country":"Japan"}',
  35.6895,
  139.6917,
  2,
  1.0,
  4,
  array['City View','Robot Butler','Smart Home','Wine Storage','Spa Bathtub','24hr Concierge','Premium Bedding','High-Speed WiFi'],
  55000,
  40000,
  110000,
  'JPY',
  20000,
  'listed',
  array[
    'properties/10000000-0000-0000-0000-000000000005/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000005/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000005/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"luxury","condition_score":10,"interior_modernity_score":9,"curb_appeal_score":10,"notable_features":[Floor-to-ceiling windows,Robot butler,Panoramic city views],"red_flags":[],"aesthetic_vibe":"futuristic_minimalist","estimated_size_bracket":"compact","lighting_quality":"adjustable ambience","visual_justification":"Cutting-edge design with premium tech integration and unparalleled cityscape vistas.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000006',
  '00000000-0000-0000-0000-000000000007',
  NULL,
  'Sydney Harbour Beach House',
  'Renovated beach house minutes from Sydney Harbour, with indoor-outdoor flow, ocean views, and easy access to beaches and cafes.',
  '{"address":"12 Ocean Street, Mosman","city":"Sydney","state":"NSW","zipCode":"2088","country":"Australia"}',
  -33.8456,
  151.2330,
  3,
  2.0,
  8,
  array['Ocean View','Beach Access','Outdoor Deck','Infinity Pool','Gas BBQ','BBQ Facilities','WiFi','Surfboard'],
  52000,
  38000,
  90000,
  'AUD',
  18000,
  'listed',
  array[
    'properties/10000000-0000-0000-0000-000000000006/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000006/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000006/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"premium","condition_score":8,"interior_modernity_score":7,"curb_appeal_score":8,"notable_features":[Ocean view,Indoor-outdoor flow,Infinity pool],"red_flags":[],"aesthetic_vibe":"coastal_modern","estimated_size_bracket":"spacious","lighting_quality":"bright afternoon sun","visual_justification":"Australian coastal living with premium finishes and entertainers-friendly layout.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000007',
  '00000000-0000-0000-0000-000000000007',
  NULL,
  'Barcelona Garden Loft',
  'Bright loft in Eixample with courtyard garden, rooftop terrace, and steps to Gaudi sites, tapas bars and the beach.',
  '{"address":"Carrer de Balmes 196","city":"Barcelona","state":"Catalonia","zipCode":"08037","country":"Spain"}',
  41.3851,
  2.1734,
  2,
  1.0,
  5,
  array['Rooftop Terrace','Courtyard Garden','Close to Gaudi','WiFi','Full Kitchen','Elevated Ceilings'],
  38000,
  28000,
  65000,
  'EUR',
  12000,
  'listed',
  array[
    'properties/10000000-0000-0000-0000-000000000007/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000007/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000007/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"premium","condition_score":8,"interior_modernity_score":7,"curb_appeal_score":7,"notable_features":[Courtyard garden,Rooftop terrace,Close to Gaudi],"red_flags":[],"aesthetic_vibe":"bohemian_chic","estimated_size_bracket":"medium","lighting_quality":"bright Mediterranean light","visual_justification":"Spanish urban living with garden space and vibrant city culture nearby.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000008',
  '00000000-0000-0000-0000-000000000007',
  NULL,
  'Dubai Marina Penthouse',
  'High-rise penthouse with floor-to-ceiling windows, infinity pool, and panoramic Persian Gulf views, premium finishes and smart home tech.',
  '{"address":"Plot 15, Dubai Marina","city":"Dubai","state":"Dubai","zipCode":"","country":"UAE"}',
  25.0766,
  55.2789,
  3,
  3.0,
  6,
  array['Infinity Pool','Gulf View','Smart Home','Chef Kitchen','Floor-to-ceiling windows','24hr Concierge','Gym Access','WiFi'],
  75000,
  55000,
  120000,
  'AED',
  25000,
  'listed',
  array[
    'properties/10000000-0000-0000-0000-000000000008/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000008/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000008/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"luxury","condition_score":9,"interior_modernity_score":8,"curb_appeal_score":9,"notable_features":[Infinity pool,Persian Gulf view,Smart home],"red_flags":[],"aesthetic_vibe":"modern_luxury","estimated_size_bracket":"spacious","lighting_quality":"bright desert sunlight","visual_justification":"UAE luxury living with premium amenities and iconic waterfront location.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000009',
  '00000000-0000-0000-0000-000000000001',
  NULL,
  'Rio de Janeiro Hilltop Retreat',
  'Charming hilltop house with favela views, tropical garden, and easy access to Copacabana and Christ the Redeemer.',
  '{"address":"Rua do Correado 40, Santa Teresa","city":"Rio de Janeiro","state":"RJ","zipCode":"20270-030","country":"Brazil"}',
  -22.9068,
  -43.1730,
  2,
  1.5,
  4,
  array['Favela View','Tropical Garden','Rooftop','WiFi','Full Kitchen','Close to Beach'],
  28000,
  20000,
  45000,
  'BRL',
  8000,
  'listed',
  array[
    'properties/10000000-0000-0000-0000-000000000009/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000009/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000009/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"premium","condition_score":7,"interior_modernity_score":6,"curb_appeal_score":6,"notable_features":[Favela view,Tropical garden,Rooftop],"red_flags":[],"aesthetic_vibe":"bohemian","estimated_size_bracket":"medium","lighting_quality":"bright tropical sun","visual_justification":"Brazilian charm with garden space and hillside location with city beach access.","confidence":"high"}'
),
(
  '10000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000007',
  NULL,
  'Istanbul Historic Loft',
  'Restored Ottoman-era loft in Sultanahmet, with original stonework, courtyard, and steps to Hagia Sophia and the Bosphorus.',
  '{"address":"Sultanhamet Mah. Cankurtaran","city":"Istanbul","state":"Istanbul","zipCode":"34122","country":"Turkey"}',
  41.0082,
  28.9784,
  2,
  1.0,
  4,
  array['Historic Charm','Courtyard','Close to Hagia Sophia','WiFi','Full Kitchen','Exposed Beam'],
  35000,
  25000,
  55000,
  'TRY',
  10000,
  'listed',
  array[
    'properties/10000000-0000-0000-0000-000000000010/cover.jpg',
    'properties/10000000-0000-0000-0000-000000000010/01.jpg'
  ],
  'properties/10000000-0000-0000-0000-000000000010/cover.jpg',
  'complete',
  now(),
  'gemini-3.6-flash',
  1,
  'd41d8cd98f00b204e9800998ecf8427e',
  '{"quality_tier":"premium","condition_score":8,"interior_modernity_score":7,"curb_appeal_score":7,"notable_features":[Original stonework,Courtyard,Close to Hagia Sophia],"red_flags":[],"aesthetic_vibe":"ottoman_revival","estimated_size_bracket":"medium","lighting_quality":"golden hour light","visual_justification":"Istanbul heritage living with central location and historic architecture.","confidence":"high"}'
)
;

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