/**
 * Backwards-compatible re-export of the canonical domain types.
 *
 * The single source of truth is `@/app/core/entities`. This module exists
 * because older files import from `@/app/lib/types`; new code should import
 * from `@/app/core/entities` directly.
 */

export type {
  UserRole,
  KycState,
  PropertyState,
  VisionState,
  BookingState,
  PayoutState,
  DisputeState,
  ApplicationState,
  QualityTier,
  VisionAnalysisResponse,
  Profile,
  Property,
} from '@/app/core/entities';
