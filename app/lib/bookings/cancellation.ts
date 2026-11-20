/**
 * Refund arithmetic (spec §15.2, §30).
 *
 * Deterministic, integer-only, driven by the policy snapshot stored on the
 * booking — never by the current policy registry. Every result is bounded by
 * the amount actually paid.
 */

import type { CancellationPolicy } from '@/app/core/entities';
import { parseDateOnly } from '@/app/lib/bookings/quote';

export type RefundTier = 'full' | 'partial' | 'none';

export interface CancellationInput {
  checkin: string;
  /** Amount that was actually charged for the stay. */
  paidMinor: number;
  nightlySubtotalMinor: number;
  policy: CancellationPolicy;
  now?: Date;
}

export interface CancellationResult {
  refundMinor: number;
  tier: RefundTier;
  hoursBeforeCheckin: number;
  reason: string;
}

const HOUR_MS = 3_600_000;

export function calculateRefund(input: CancellationInput): CancellationResult {
  const now = input.now ?? new Date();
  const checkin = parseDateOnly(input.checkin);
  const hoursBefore = (checkin.getTime() - now.getTime()) / HOUR_MS;

  const { policy } = input;
  const paid = Math.max(0, Math.trunc(input.paidMinor));

  if (hoursBefore <= 0) {
    return {
      refundMinor: 0,
      tier: 'none',
      hoursBeforeCheckin: Math.floor(hoursBefore),
      reason: 'Check-in has already started; this booking is not refundable.',
    };
  }

  if (hoursBefore >= policy.fullRefundHours) {
    return {
      refundMinor: paid,
      tier: 'full',
      hoursBeforeCheckin: Math.floor(hoursBefore),
      reason: `Cancelled at least ${policy.fullRefundHours}h before check-in: full refund.`,
    };
  }

  if (policy.partialRefundHours > 0 && hoursBefore >= policy.partialRefundHours) {
    const pct = Math.max(0, Math.min(100, policy.partialRefundPct));
    // Percentage applies to the nightly subtotal; the cleaning fee is kept.
    const refund = Math.floor((input.nightlySubtotalMinor * pct) / 100);
    return {
      refundMinor: Math.min(paid, Math.max(0, refund)),
      tier: 'partial',
      hoursBeforeCheckin: Math.floor(hoursBefore),
      reason: `Cancelled ${policy.partialRefundHours}h–${policy.fullRefundHours}h before check-in: ${pct}% of the nightly subtotal.`,
    };
  }

  return {
    refundMinor: 0,
    tier: 'none',
    hoursBeforeCheckin: Math.floor(hoursBefore),
    reason: `Cancelled less than ${policy.partialRefundHours}h before check-in: no refund.`,
  };
}
