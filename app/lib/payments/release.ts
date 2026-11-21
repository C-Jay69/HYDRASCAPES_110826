/**
 * Payout release eligibility (spec §15.1).
 *
 * The release worker may only touch payouts that are:
 *   - not frozen (disputes set `frozen` in the database),
 *   - not already released,
 *   - past `releasable_at`.
 *
 * Transfer slots are tracked independently because owner and host are paid to
 * different Connect accounts and either one may be missing.
 */

import type { Payout } from '@/app/core/entities';

export type TransferSlot = 'owner' | 'host';

const RELEASABLE_STATUSES = new Set(['held', 'releasable']);

export function payoutIsDue(payout: Payout, now: Date): boolean {
  if (!RELEASABLE_STATUSES.has(payout.status)) return false;
  if (payout.released_at) return false;
  const dueAt = new Date(payout.releasable_at).getTime();
  return Number.isFinite(dueAt) && dueAt <= now.getTime();
}

/** Slots that still need a transfer, in the order they should be attempted. */
export function pendingTransfers(payout: Payout): TransferSlot[] {
  const slots: TransferSlot[] = [];
  if (!payout.stripe_transfer_owner_id) slots.push('owner');
  if (Number(payout.host_amount_minor) > 0 && payout.host_id && !payout.stripe_transfer_host_id) {
    slots.push('host');
  }
  return slots;
}

/** True when nothing is left to pay out for this row. */
export function isFullyTransferred(payout: Payout): boolean {
  return pendingTransfers(payout).length === 0;
}

/** Stable Stripe idempotency key (spec §15.1 suggests exactly this shape). */
export function transferIdempotencyKey(bookingId: string, slot: TransferSlot): string {
  return `booking:${bookingId}:${slot}`;
}

/** Stripe `transfer_group` used to reconcile an uncertain prior attempt. */
export function transferGroup(bookingId: string): string {
  return `booking:${bookingId}`;
}

/** Amount to send to a slot's Connect account. */
export function transferAmountMinor(payout: Payout, slot: TransferSlot): number {
  return slot === 'owner'
    ? Math.trunc(Number(payout.owner_amount_minor))
    : Math.trunc(Number(payout.host_amount_minor));
}
