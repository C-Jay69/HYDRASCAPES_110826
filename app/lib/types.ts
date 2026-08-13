export type UserRole = 'owner' | 'host' | 'guest' | 'admin';

export type KycState = 'none' | 'pending' | 'verified' | 'rejected';

export type PropertyState = 'draft' | 'pending_host' | 'listed' | 'managed' | 'unlisted' | 'archived';

export type BookingState =
  | 'pending'
  | 'confirmed'
  | 'checkin'
  | 'in_progress'
  | 'checkout'
  | 'completed'
  | 'cancelled'
  | 'refunded';

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  kyc_status: KycState;
  kyc_verified_at: string | null;
  avatar_path: string | null;
  location_json: Record<string, unknown>;
  bio: string | null;
  phone: string | null;
  stripe_connect_account_id: string | null;
  created_at: string;
  updated_at: string;
};

export type Property = {
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
  vision_status: 'pending' | 'analyzing' | 'completed' | 'failed';
  created_at: string;
  updated_at: string;
};