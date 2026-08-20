export type UserRole = 'owner' | 'host' | 'guest' | 'admin';

export type KycState = 'none' | 'pending' | 'verified' | 'rejected';

export type PropertyState =
  | 'draft'
  | 'pending_host'
  | 'listed'
  | 'managed'
  | 'unlisted'
  | 'archived';

export type BookingState =
  | 'pending'
  | 'confirmed'
  | 'checkin'
  | 'in_progress'
  | 'checkout'
  | 'completed'
  | 'cancelled'
  | 'refunded';

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

export interface PropertySummary {
  id: string;
  title: string;
  status: PropertyState;
  ownerId: string;
  basePriceMinor: number;
  currency: string;
  visionStatus: 'pending' | 'analyzing' | 'completed' | 'failed';
}