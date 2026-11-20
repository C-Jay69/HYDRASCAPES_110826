/**
 * Revenue settlement (spec §5.9, §30).
 *
 * The payout row's database constraint requires
 * `owner + host + platform = settlement_base` exactly. Percentages are
 * therefore applied to platform and host, and the owner receives the
 * remainder — that way rounding can never break the invariant.
 */

import type { RevenueSplit } from '@/app/lib/bookings/types';

export interface SettlementInput {
  totalMinor: number;
  split: RevenueSplit;
  /** False when no co-host is assigned; the host share then goes to the owner. */
  hasHost: boolean;
}

export interface Settlement {
  ownerAmountMinor: number;
  hostAmountMinor: number;
  platformAmountMinor: number;
  ownerPct: number;
  hostPct: number;
  platformPct: number;
}

/** Seeded `platform_settings.revenue_split`. */
export const DEFAULT_SPLIT: RevenueSplit = {
  ownerPct: 82,
  hostPct: 15,
  platformPct: 3,
};

export function computeSettlement(input: SettlementInput): Settlement {
  const total = Math.trunc(input.totalMinor);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error(`Invalid settlement base: ${input.totalMinor}`);
  }

  const platformPct = clampPct(input.split.platformPct);
  const hostPct = input.hasHost ? clampPct(input.split.hostPct) : 0;

  const platformAmount = Math.round((total * platformPct) / 100);
  const hostAmount = Math.round((total * hostPct) / 100);
  const ownerAmount = total - platformAmount - hostAmount;

  if (ownerAmount < 0) {
    throw new Error('Revenue split exceeds the settlement base');
  }

  return {
    ownerAmountMinor: ownerAmount,
    hostAmountMinor: hostAmount,
    platformAmountMinor: platformAmount,
    ownerPct: 100 - platformPct - hostPct,
    hostPct,
    platformPct,
  };
}

function clampPct(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(100, value);
}
