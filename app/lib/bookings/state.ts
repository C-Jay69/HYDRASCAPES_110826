/**
 * Booking state machine (spec §5.4).
 *
 * Transitions are explicit and the server refuses anything not listed here.
 * A client can never set a booking status directly — the API routes call
 * `assertTransition` before writing, and the database revokes client writes to
 * `bookings` entirely.
 */

import type { BookingState } from '@/app/core/entities';

const TRANSITIONS: Record<BookingState, readonly BookingState[]> = {
  // A booking starts unpaid, holding no guaranteed inventory until payment.
  pending_payment: ['reserved', 'confirmed', 'cancelled'],
  // Reserved is for holds that are not yet paid (host assignment, offline pay).
  reserved: ['confirmed', 'cancelled'],
  confirmed: ['checked_in', 'cancelled'],
  checked_in: ['checked_out'],
  checked_out: ['completed'],
  completed: [],
  // A cancelled booking becomes "refunded" once the provider confirms the money
  // actually went back; until then the refund is only an intention.
  cancelled: ['refunded'],
  refunded: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: BookingState,
    readonly to: BookingState,
  ) {
    super(`Booking cannot move from "${from}" to "${to}"`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition(from: BookingState, to: BookingState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: BookingState, to: BookingState): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** States that hold the property's dates (mirrors the exclusion constraint). */
export const LIVE_BOOKING_STATES: readonly BookingState[] = [
  'pending_payment',
  'reserved',
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
];

export function isLiveStatus(status: BookingState): boolean {
  return LIVE_BOOKING_STATES.includes(status);
}

export function isTerminal(status: BookingState): boolean {
  return TRANSITIONS[status].length === 0;
}
