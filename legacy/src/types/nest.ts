/**
 * Nest v5 Application Types
 */

export interface Wishlist {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  property_ids: string[];
  created_at: string;
  updated_at: string;
}

export type UserRole = 'owner' | 'host' | 'guest' | 'admin';
export type KYCState = 'none' | 'pending' | 'verified' | 'rejected' | 'expired';
export type PropertyState = 'draft' | 'listed' | 'pending_host' | 'managed' | 'suspended';
export type VisionState = 'pending' | 'processing' | 'complete' | 'failed' | 'stale';
export type ApplicationState = 'applied' | 'accepted' | 'rejected' | 'withdrawn';
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
export type WebhookProcessingState = 'processing' | 'processed' | 'failed';

export interface LocationJson {
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface Profile {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  avatar_path?: string;
  location_json: LocationJson;
  bio?: string;
  rating_avg?: number;
  rating_count: number;
  kyc_status: KYCState;
  kyc_verified_at?: string;
  stripe_connect_id?: string;
  stripe_customer_id?: string;
  created_at: string;
  updated_at: string;
}

export interface VisionAnalysis {
  quality_tier: 'budget' | 'mid_range' | 'premium' | 'luxury';
  condition_score: number; // 1-10
  interior_modernity_score: number; // 1-10
  curb_appeal_score: number; // 1-10
  notable_features: string[];
  red_flags: string[];
  aesthetic_vibe: 'cozy_rustic' | 'modern_minimalist' | 'coastal_breeze' | 'urban_industrial' | 'luxury_estate' | 'classic_warmth';
  estimated_size_bracket: 'compact' | 'medium' | 'spacious' | 'palatial';
  lighting_quality: 'poor' | 'adequate' | 'bright_natural' | 'exceptional';
  visual_justification: string;
  confidence: 'low' | 'medium' | 'high';
  highlights?: string[];
}

export interface Property {
  id: string;
  owner_id: string;
  assigned_host_id?: string;
  title: string;
  description: string;
  address_json: LocationJson;
  latitude: number;
  longitude: number;
  bedrooms: number;
  bathrooms: number;
  max_guests: number;
  amenities: string[];
  base_price_minor: number; // integer minor currency units (cents)
  min_price_minor: number;
  max_price_minor: number;
  currency: string;
  cleaning_fee_minor: number;
  status: PropertyState;
  photos: string[];
  cover_photo?: string;
  vision_analysis?: VisionAnalysis;
  vision_status: VisionState;
  vision_analyzed_at?: string;
  vision_model?: string;
  vision_schema_version?: number;
  vision_photos_hash?: string;
  created_at: string;
  updated_at: string;
  
  // Joined virtual fields
  owner_name?: string;
  host_name?: string;
  host_avatar?: string;
  is_superhost?: boolean;
  is_verified_host?: boolean;
  host_rating_avg?: number;
  rating_avg?: number;
  review_count?: number;
}

export interface AvailabilityBlock {
  id: string;
  property_id: string;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  reason?: string;
  created_by?: string;
  created_at: string;
}

export interface Booking {
  id: string;
  property_id: string;
  guest_id: string;
  host_id?: string;
  owner_id: string;
  checkin: string;  // YYYY-MM-DD
  checkout: string; // YYYY-MM-DD
  nights: number;
  guests_count: number;
  per_night_rate_minor: number;
  nightly_subtotal_minor: number;
  cleaning_fee_minor: number;
  taxes_minor: number;
  total_amount_minor: number;
  currency: string;
  status: BookingState;
  stripe_payment_intent_id?: string;
  cancellation_policy_key: 'Flexible' | 'Moderate' | 'Strict';
  cancellation_policy_version: number;
  cancellation_policy_snapshot: Record<string, any>;
  cancelled_at?: string;
  cancelled_by?: string;
  refund_amount_minor?: number;
  guest_preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;

  // Joined fields
  property_title?: string;
  property_cover?: string;
  guest_name?: string;
  owner_name?: string;
  host_name?: string;
}

export interface BookingInspection {
  id: string;
  booking_id: string;
  kind: 'check_in' | 'check_out';
  photos: string[];
  notes?: string;
  submitted_by: string;
  submitted_at: string;
  submitter_name?: string;
}

export interface HostApplication {
  id: string;
  property_id: string;
  host_id: string;
  status: ApplicationState;
  proposed_fee_pct: number;
  pitch_text?: string;
  ai_match_score?: number; // 0-100
  ai_match_reasoning?: string;
  ai_model?: string;
  ai_scored_at?: string;
  created_at: string;
  responded_at?: string;

  // Joined
  host_name?: string;
  host_avatar?: string;
  host_rating?: number;
  property_title?: string;
}

export interface MessageThread {
  id: string;
  booking_id?: string;
  property_id?: string;
  subject?: string;
  created_at: string;
  updated_at: string;
  participants?: Profile[];
  last_message?: string;
  last_message_at?: string;
}

export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  media_path?: string;
  created_at: string;
  sender_name?: string;
  sender_avatar?: string;
}

export interface Review {
  id: string;
  booking_id: string;
  reviewer_id: string;
  target_type: 'property' | 'host' | 'guest';
  target_id: string;
  rating: number; // 1-5
  comment?: string;
  created_at: string;
  reviewer_name?: string;
  reviewer_avatar?: string;
}

export interface Payout {
  id: string;
  booking_id: string;
  owner_id: string;
  host_id?: string;
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
  stripe_transfer_owner_id?: string;
  stripe_transfer_host_id?: string;
  failure_reason?: string;
  released_at?: string;
  created_at: string;

  // Joined
  owner_name?: string;
  host_name?: string;
  property_title?: string;
}

export interface DisputeAssessment {
  damage_detected: boolean;
  severity: 'low' | 'medium' | 'high' | 'severe';
  itemised_findings: string[];
  evidence_quality: 'low' | 'medium' | 'high';
  recommended_award_pct: number;
  rationale: string;
  requires_human_review: boolean;
}

export interface Dispute {
  id: string;
  booking_id: string;
  claimant_id: string;
  respondent_id: string;
  amount_claimed_minor: number;
  description: string;
  status: DisputeState;
  ai_assessment?: DisputeAssessment;
  ai_model?: string;
  ai_assessed_at?: string;
  admin_decision?: string;
  admin_award_claimant_minor?: number;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;

  // Joined
  claimant_name?: string;
  respondent_name?: string;
  property_title?: string;
}

export interface PricingTraceFactor {
  key: string;
  label: string;
  multiplier: number;
  delta_minor: number;
  source: string;
}

export interface PriceSuggestion {
  id: number;
  property_id: string;
  stay_date: string;
  current_price_minor: number;
  suggested_price_minor: number;
  price_low_minor: number;
  price_high_minor: number;
  confidence: 'low' | 'medium' | 'high';
  reasoning_trace: {
    base_price_minor: number;
    factors: PricingTraceFactor[];
    ai_multiplier: number;
    ai_rationale: string;
    final_suggested_minor: number;
  };
  multipliers: Record<string, number>;
  model?: string;
  status: 'pending' | 'applied' | 'rejected' | 'superseded';
  applied_at?: string;
  applied_by?: string;
  created_at: string;
}

export interface PricingRule {
  property_id: string;
  auto_apply: boolean;
  auto_apply_threshold_pct: number;
  enable_event_pricing: boolean;
  enable_seasonality: boolean;
  enable_vision_adjust: boolean;
  enable_weather: boolean;
  floor_price_minor?: number;
  ceiling_price_minor?: number;
  updated_by?: string;
  updated_at: string;
}

export interface AuditLog {
  id: number;
  actor_id?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  old_values?: Record<string, any>;
  new_values?: Record<string, any>;
  request_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
  actor_name?: string;
}

export interface N8nWorkflow {
  id: string;
  name: string;
  description: string;
  lastRunStatus: 'success' | 'running' | 'idle' | 'failed';
  lastRunTime?: string;
  triggerEvent: string;
  nodesCount: number;
}
