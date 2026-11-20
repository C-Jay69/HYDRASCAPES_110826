/**
 * Named cancellation policies (spec §15.2).
 *
 * Policies are data, versioned, and snapshotted onto each booking. Changing a
 * policy here changes new bookings only: an existing booking keeps the
 * snapshot it was created with, so refund arithmetic never shifts under
 * someone's feet.
 */

import type { CancellationPolicy, CancellationPolicyKey } from '@/app/core/entities';

export const CANCELLATION_POLICIES: Record<CancellationPolicyKey, CancellationPolicy> = {
  flexible: {
    key: 'flexible',
    version: 1,
    label: 'Flexible',
    fullRefundHours: 24,
    partialRefundHours: 0,
    partialRefundPct: 0,
  },
  moderate: {
    key: 'moderate',
    version: 1,
    label: 'Moderate',
    fullRefundHours: 24 * 5,
    partialRefundHours: 48,
    partialRefundPct: 50,
  },
  strict: {
    key: 'strict',
    version: 1,
    label: 'Strict',
    fullRefundHours: 24 * 14,
    partialRefundHours: 24 * 7,
    partialRefundPct: 50,
  },
};

export function getCancellationPolicy(key: string): CancellationPolicy {
  const policy = CANCELLATION_POLICIES[key as CancellationPolicyKey];
  return policy ?? CANCELLATION_POLICIES.moderate;
}

/** The JSON stored in `bookings.cancellation_policy_snapshot`. */
export function snapshotPolicy(policy: CancellationPolicy): Record<string, unknown> {
  return {
    key: policy.key,
    version: policy.version,
    label: policy.label,
    full_refund_hours: policy.fullRefundHours,
    partial_refund_hours: policy.partialRefundHours,
    partial_refund_pct: policy.partialRefundPct,
  };
}

/** Reads a snapshot back, falling back to the named policy if it is incomplete. */
export function policyFromSnapshot(
  key: string,
  snapshot: Record<string, unknown> | null | undefined,
): CancellationPolicy {
  const fallback = getCancellationPolicy(key);
  if (!snapshot || typeof snapshot.full_refund_hours !== 'number') return fallback;

  return {
    key: fallback.key,
    version: typeof snapshot.version === 'number' ? snapshot.version : fallback.version,
    label: typeof snapshot.label === 'string' ? snapshot.label : fallback.label,
    fullRefundHours: snapshot.full_refund_hours,
    partialRefundHours:
      typeof snapshot.partial_refund_hours === 'number' ? snapshot.partial_refund_hours : 0,
    partialRefundPct:
      typeof snapshot.partial_refund_pct === 'number' ? snapshot.partial_refund_pct : 0,
  };
}
