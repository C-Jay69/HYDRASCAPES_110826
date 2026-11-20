/**
 * Canonical domain entities.
 *
 * These types mirror the PostgreSQL enums and columns in
 * `supabase/migrations/0001_init.sql`. The database is the final authority:
 * if a value is not in the database enum, writing it will fail at runtime,
 * so these unions must stay identical to the SQL definitions.
 */

export type UserRole = 'owner' | 'host' | 'guest' | 'admin';

export type KycState = 'none' | 'pending' | 'verified' | 'rejected' | 'expired';

export type PropertyState =
  | 'draft'
  | 'listed'
  | 'pending_host'
  | 'managed'
  | 'suspended';

export type VisionState =
  | 'pending'
  | 'processing'
  | 'complete'
  | 'failed'
  | 'stale';

export type BookingState =
  | 'pending_payment'
  | 'reserved'
  | 'confirmed'
  | 'checked_in'
  | 'checked_out'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type PayoutState = 'held' | 'releasable' | 'released' | 'failed' | 'frozen';

export type DisputeState = 'open' | 'under_review' | 'resolved' | 'withdrawn';

export type ApplicationState = 'applied' | 'accepted' | 'rejected' | 'withdrawn';

export interface Coordinates {
  latitude: number | null;
  longitude: number | null;
}

export interface Address {
  json: Record<string, unknown>;
}

export interface PhotoReference {
  path: string;
  url: string | null;
}

export interface PropertyImage {
  storagePath: string;
  publicUrl: string;
}

export interface Money {
  amountMinor: number;
  currency: string;
}

/** Controlled vocabulary produced by the vision pipeline (spec §9). */
export type QualityTier = 'Luxury' | 'Premium' | 'Standard' | 'Economy';

/** Validated output of a property vision analysis. */
export interface VisionAnalysisResponse {
  conditionScore: number;
  interiorModernity: number;
  curbAppeal: number;
  qualityTier: QualityTier;
  highlights: string[];
  redFlags: string[];
  reasoning: string;
  confidence: number;
}

/** Row shape of `public.profiles`. */
export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_path: string | null;
  location_json: Record<string, unknown>;
  bio: string | null;
  rating_avg: number | null;
  rating_count: number;
  kyc_status: KycState;
  kyc_verified_at: string | null;
  stripe_connect_id: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

/** Row shape of `public.properties`. Money is always integer minor units. */
export interface Property {
  id: string;
  owner_id: string;
  assigned_host_id: string | null;
  title: string;
  description: string | null;
  address_json: Record<string, unknown>;
  latitude: number | null;
  longitude: number | null;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  amenities: string[];
  base_price_minor: number;
  min_price_minor: number;
  max_price_minor: number;
  currency: string;
  cleaning_fee_minor: number;
  status: PropertyState;
  photos: string[];
  cover_photo: string | null;
  vision_analysis: Record<string, unknown>;
  vision_status: VisionState;
  vision_analyzed_at: string | null;
  vision_model: string | null;
  vision_schema_version: number | null;
  vision_photos_hash: string | null;
  created_at: string;
  updated_at: string;
}

export interface PropertySummary {
  id: string;
  title: string;
  status: PropertyState;
  ownerId: string;
  basePriceMinor: number;
  currency: string;
  visionStatus: VisionState;
}

/** Row shape of `public.bookings`. Money is integer minor units. */
export interface Booking {
  id: string;
  property_id: string;
  guest_id: string;
  host_id: string | null;
  owner_id: string;
  checkin: string;
  checkout: string;
  nights: number;
  guests_count: number;
  per_night_rate_minor: number;
  nightly_subtotal_minor: number;
  cleaning_fee_minor: number;
  taxes_minor: number;
  total_amount_minor: number;
  currency: string;
  status: BookingState;
  stripe_payment_intent_id: string | null;
  cancellation_policy_key: string;
  cancellation_policy_version: number;
  cancellation_policy_snapshot: Record<string, unknown>;
  cancelled_at: string | null;
  cancelled_by: string | null;
  refund_amount_minor: number | null;
  guest_preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Row shape of `public.payouts`. */
export interface Payout {
  id: string;
  booking_id: string;
  owner_id: string;
  host_id: string | null;
  settlement_base_minor: number;
  owner_amount_minor: number;
  host_amount_minor: number;
  platform_amount_minor: number;
  owner_pct_snapshot: number;
  host_pct_snapshot: number;
  platform_pct_snapshot: number;
  currency: string;
  status: PayoutState;
  releasable_at: string;
  stripe_transfer_owner_id: string | null;
  stripe_transfer_host_id: string | null;
  failure_reason: string | null;
  released_at: string | null;
  created_at: string;
}

/** A named, versioned cancellation policy (spec §15.2). */
export interface CancellationPolicy {
  key: CancellationPolicyKey;
  version: number;
  label: string;
  /** Full refund while cancelling at least this many hours before check-in. */
  fullRefundHours: number;
  /** Partial refund window; 0 means no partial tier. */
  partialRefundHours: number;
  /** Percentage of the nightly subtotal returned inside the partial window. */
  partialRefundPct: number;
}

export type CancellationPolicyKey = 'flexible' | 'moderate' | 'strict';

export const DEFAULT_CANCELLATION_POLICY: CancellationPolicyKey = 'moderate';
