/** Shared booking types that are not persisted rows. */

export interface RevenueSplit {
  ownerPct: number;
  hostPct: number;
  platformPct: number;
}

export interface AvailabilityWindow {
  start: string;
  end: string;
  reason: string | null;
}
