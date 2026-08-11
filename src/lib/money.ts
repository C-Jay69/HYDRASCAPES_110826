/**
 * Money & Financial Utilities for Nest
 * All financial calculations MUST use integer minor currency units (cents).
 * Never perform floating-point money arithmetic directly.
 */

export function dollarsToCents(dollars: number): number {
  return Math.round(dollars * 100);
}

export function centsToDollars(cents: number): number {
  return cents / 100;
}

export function formatCurrency(cents: number, currency: string = 'USD'): string {
  const dollars = cents / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(dollars);
}

export interface PayoutSplitResult {
  settlementBaseMinor: number;
  ownerAmountMinor: number;
  hostAmountMinor: number;
  platformAmountMinor: number;
  ownerPctSnapshot: number;
  hostPctSnapshot: number;
  platformPctSnapshot: number;
}

/**
 * Calculates deterministic settlement payout split.
 * Guarantees sum(ownerAmount + hostAmount + platformAmount) === settlementBase
 */
export function calculatePayoutSplit(
  totalBaseCents: number,
  ownerPct: number = 82,
  hostPct: number = 15,
  platformPct: number = 3
): PayoutSplitResult {
  if (totalBaseCents < 0) throw new Error('Settlement base cannot be negative');

  // Normalize percentages
  const sumPct = ownerPct + hostPct + platformPct;
  const normOwnerPct = (ownerPct / sumPct) * 100;
  const normHostPct = (hostPct / sumPct) * 100;
  const normPlatformPct = (platformPct / sumPct) * 100;

  // Calculate raw minor units
  const hostAmount = Math.floor((totalBaseCents * normHostPct) / 100);
  const platformAmount = Math.floor((totalBaseCents * normPlatformPct) / 100);
  // Remainder goes to owner to guarantee exact reconciliation
  const ownerAmount = totalBaseCents - hostAmount - platformAmount;

  return {
    settlementBaseMinor: totalBaseCents,
    ownerAmountMinor: ownerAmount,
    hostAmountMinor: hostAmount,
    platformAmountMinor: platformAmount,
    ownerPctSnapshot: Number(normOwnerPct.toFixed(4)),
    hostPctSnapshot: Number(normHostPct.toFixed(4)),
    platformPctSnapshot: Number(normPlatformPct.toFixed(4)),
  };
}

/**
 * Calculates deterministic cancellation refund amount.
 */
export function calculateCancellationRefund(
  totalAmountMinor: number,
  policyKey: 'Flexible' | 'Moderate' | 'Strict',
  daysBeforeCheckin: number
): number {
  if (daysBeforeCheckin >= 14) {
    // 100% refund for all policies 14+ days ahead
    return totalAmountMinor;
  }

  if (policyKey === 'Flexible') {
    if (daysBeforeCheckin >= 1) return totalAmountMinor; // 100% if 24h prior
    return Math.floor(totalAmountMinor * 0.5); // 50% on check-in day
  }

  if (policyKey === 'Moderate') {
    if (daysBeforeCheckin >= 5) return totalAmountMinor; // 100% if 5 days prior
    return Math.floor(totalAmountMinor * 0.5); // 50% within 5 days
  }

  if (policyKey === 'Strict') {
    if (daysBeforeCheckin >= 7) return Math.floor(totalAmountMinor * 0.5); // 50% if 7 days prior
    return 0; // 0% refund within 7 days
  }

  return 0;
}
