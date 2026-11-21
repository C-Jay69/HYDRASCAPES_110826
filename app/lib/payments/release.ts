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

export interface ReversalAllocation {
  slot: TransferSlot;
  transferId: string;
  amountMinor: number;
}

/**
 * Splits a refund across already-transferred slots (spec §15.1; Stripe plan
 * review). Payees give back only what they received; the platform covers its
 * own share and any rounding remainder. Returns [] when nothing was paid out.
 */
export function planReversals(payout: Payout, refundMinor: number): ReversalAllocation[] {
  const refund = Math.max(0, Math.trunc(refundMinor));
  if (refund === 0) return [];

  const candidates: { slot: TransferSlot; transferId: string; available: number }[] = [];
  if (payout.stripe_transfer_owner_id) {
    candidates.push({
      slot: 'owner',
      transferId: payout.stripe_transfer_owner_id,
      available: Math.max(0, Number(payout.owner_amount_minor) - Number(payout.reversed_owner_minor ?? 0)),
    });
  }
  if (payout.stripe_transfer_host_id) {
    candidates.push({
      slot: 'host',
      transferId: payout.stripe_transfer_host_id,
      available: Math.max(0, Number(payout.host_amount_minor) - Number(payout.reversed_host_minor ?? 0)),
    });
  }

  const usable = candidates.filter((candidate) => candidate.available > 0);
  const pool = usable.reduce((sum, candidate) => sum + candidate.available, 0);
  if (pool === 0) return [];

  const capped = Math.min(refund, pool);
  const allocations: ReversalAllocation[] = [];
  let allocated = 0;

  usable.forEach((candidate, index) => {
    const isLast = index === usable.length - 1;
    const share = isLast
      ? capped - allocated
      : Math.floor((capped * candidate.available) / pool);
    const amount = Math.min(Math.max(share, 0), candidate.available);
    if (amount > 0) {
      allocations.push({ slot: candidate.slot, transferId: candidate.transferId, amountMinor: amount });
      allocated += amount;
    }
  });

  return allocations;
}

/** Idempotency key for a clawback, distinct from the original transfer key. */
export function reversalIdempotencyKey(bookingId: string, slot: TransferSlot): string {
  return `booking:${bookingId}:${slot}:reversal`;
}
