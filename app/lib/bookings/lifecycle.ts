/**
 * Booking lifecycle progression (spec §5.4).
 *
 * Nothing in this app currently moves a booking from confirmed to checked-in
 * to completed on a timer, so trips sit in "confirmed" forever. This module
 * decides the next state from the dates alone; the scheduler route applies it.
 *
 * Pure: no clock, no database. `now` is always injected.
 */

import type { BookingState } from '@/app/core/entities';
import { parseDateOnly } from '@/app/lib/bookings/quote';

/** A stay is treated as completed this long after checkout. */
export const COMPLETION_DELAY_HOURS = 24;
const HOUR_MS = 3_600_000;

export interface LifecycleInput {
  status: BookingState;
  checkin: string;
  checkout: string;
  now: Date;
}

/**
 * The state this booking should be in by `now`, or null if it is already
 * where it belongs. Only forward, documented transitions are returned.
 */
export function lifecycleTarget(input: LifecycleInput): BookingState | null {
  const { status, now } = input;

  switch (status) {
    case 'confirmed': {
      const checkinAt = parseDateOnly(input.checkin);
      if (now.getTime() >= checkinAt.getTime()) return 'checked_in';
      return null;
    }
    case 'checked_in': {
      const checkoutAt = parseDateOnly(input.checkout);
      if (now.getTime() >= checkoutAt.getTime()) return 'checked_out';
      return null;
    }
    case 'checked_out': {
      const checkoutAt = parseDateOnly(input.checkout);
      const completeAt = checkoutAt.getTime() + COMPLETION_DELAY_HOURS * HOUR_MS;
      if (now.getTime() >= completeAt) return 'completed';
      return null;
    }
    default:
      return null;
  }
}
