/**
 * Revenue settlement (spec §5.9, §30; Stripe plan review).
 *
 * The charge is not fully distributable: Stripe's processing fee comes out of
 * the platform's balance, so splitting the gross 82/15/3 left the platform
 * paying fees out of its own 3% — often at a loss.
 *
 * Order of operations:
 *   gross charge
 *   − estimated processing fee        (platform cost, never over 50% of gross)
 *   = settlement base
 *   platform and host take their percentages of the base; the owner receives
 *   the remainder, so the three amounts always reconcile to the base.
 */

import type { RevenueSplit } from '@/app/lib/bookings/types';

export interface ProcessingFeeConfig {
  /** Basis points of the charge, e.g. 290 = 2.90%. */
  bps: number;
  /** Fixed component in minor units. */
  fixedMinor: number;
}

/** Conservative default; override via `platform_settings.processing_fees`. */
export const DEFAULT_PROCESSING_FEES: ProcessingFeeConfig = { bps: 290, fixedMinor: 30 };

export interface SettlementInput {
  /** Amount charged to the guest, tax inclusive. */
  totalMinor: number;
  /** Tax collected on behalf of authorities; never distributed. */
  taxMinor?: number;
  split: RevenueSplit;
  /** False when no co-host is assigned; the host share then goes to the owner. */
  hasHost: boolean;
  /** Overrides the estimated fee. */
  processingFeeMinor?: number;
  feeConfig?: ProcessingFeeConfig;
}

export interface Settlement {
  taxMinor: number;
  processingFeeMinor: number;
  settlementBaseMinor: number;
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

/** Estimated Stripe fee for a charge. Never consumes the whole charge. */
export function estimateProcessingFee(
  totalMinor: number,
  config: ProcessingFeeConfig = DEFAULT_PROCESSING_FEES,
): number {
  const total = Math.trunc(totalMinor);
  if (!Number.isSafeInteger(total) || total <= 0) return 0;

  const bps = Number.isFinite(config.bps) ? Math.max(0, Math.trunc(config.bps)) : 0;
  const fixed = Number.isFinite(config.fixedMinor) ? Math.max(0, Math.trunc(config.fixedMinor)) : 0;

  const fee = Math.round((total * bps) / 10_000) + fixed;
  // A fee at or above the charge would make the split meaningless; cap at half.
  return Math.min(fee, Math.floor(total / 2));
}

export function computeSettlement(input: SettlementInput): Settlement {
  const total = Math.trunc(input.totalMinor);
  if (!Number.isSafeInteger(total) || total < 0) {
    throw new Error(`Invalid settlement base: ${input.totalMinor}`);
  }

  const taxMinor = Math.max(0, Math.trunc(input.taxMinor ?? 0));
  if (taxMinor > total) {
    throw new Error('Tax exceeds the charge');
  }

  // Estimate the fee on the distributable part, not on tax that is merely
  // passing through the platform.
  const taxableBase = total - taxMinor;
  const processingFeeMinor =
    input.processingFeeMinor !== undefined
      ? Math.max(0, Math.trunc(input.processingFeeMinor))
      : estimateProcessingFee(taxableBase, input.feeConfig);

  if (processingFeeMinor > taxableBase) {
    throw new Error('Processing fee exceeds the charge');
  }

  const base = taxableBase - processingFeeMinor;

  const platformPct = clampPct(input.split.platformPct);
  const hostPct = input.hasHost ? clampPct(input.split.hostPct) : 0;

  const platformAmount = Math.round((base * platformPct) / 100);
  const hostAmount = Math.round((base * hostPct) / 100);
  const ownerAmount = base - platformAmount - hostAmount;

  if (ownerAmount < 0) {
    throw new Error('Revenue split exceeds the settlement base');
  }

  return {
    taxMinor,
    processingFeeMinor,
    settlementBaseMinor: base,
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
