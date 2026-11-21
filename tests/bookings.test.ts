import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assertTransition,
  isTerminal,
  InvalidTransitionError,
} from '../app/lib/bookings/state';
import { buildQuote, nightsBetween, QuoteError } from '../app/lib/bookings/quote';
import { calculateRefund } from '../app/lib/bookings/cancellation';
import {
  computeSettlement,
  estimateProcessingFee,
  DEFAULT_SPLIT,
} from '../app/lib/bookings/settlement';
import { getCancellationPolicy, snapshotPolicy, policyFromSnapshot } from '../app/lib/bookings/policies';

describe('booking state machine', () => {
  it('allows the documented happy path', () => {
    expect(canTransition('pending_payment', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'checked_in')).toBe(true);
    expect(canTransition('checked_in', 'checked_out')).toBe(true);
    expect(canTransition('checked_out', 'completed')).toBe(true);
  });

  it('refuses nonsense transitions', () => {
    expect(canTransition('completed', 'confirmed')).toBe(false);
    expect(canTransition('cancelled', 'confirmed')).toBe(false);
    expect(canTransition('checked_in', 'pending_payment')).toBe(false);
    expect(() => assertTransition('completed', 'checked_in')).toThrow(InvalidTransitionError);
  });

  it('treats terminal states as terminal', () => {
    expect(isTerminal('completed')).toBe(true);
    expect(isTerminal('refunded')).toBe(true);
    expect(isTerminal('confirmed')).toBe(false);
    // Cancelled still has one legitimate exit: provider-confirmed refund.
    expect(canTransition('cancelled', 'refunded')).toBe(true);
  });
});

describe('quote', () => {
  const base = {
    basePriceMinor: 15000,
    cleaningFeeMinor: 5000,
    currency: 'usd',
    checkin: '2026-12-01',
    checkout: '2026-12-04',
    guestsCount: 2,
    maxGuests: 4,
  };

  it('multiplies nights by the nightly rate and adds the cleaning fee', () => {
    const quote = buildQuote(base);
    expect(quote.nights).toBe(3);
    expect(quote.nightlySubtotalMinor).toBe(45000);
    expect(quote.totalMinor).toBe(50000);
    expect(quote.currency).toBe('USD');
  });

  it('counts nights across a DST boundary without drifting', () => {
    expect(nightsBetween('2026-03-28', '2026-03-31')).toBe(3);
    expect(nightsBetween('2026-10-24', '2026-10-27')).toBe(3);
  });

  it('rejects checkout on or before checkin', () => {
    expect(() => buildQuote({ ...base, checkout: '2026-12-01' })).toThrow(QuoteError);
    expect(() => buildQuote({ ...base, checkout: '2026-11-30' })).toThrow(/after check-in/);
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => buildQuote({ ...base, checkin: '01/12/2026' })).toThrow(/YYYY-MM-DD/);
    expect(() => buildQuote({ ...base, checkin: '2026-02-30' })).toThrow(/Invalid calendar date/);
  });

  it('enforces the property guest limit', () => {
    expect(() => buildQuote({ ...base, guestsCount: 5 })).toThrow(/at most 4 guests/);
  });

  it('rejects an invalid nightly price instead of quoting zero', () => {
    expect(() => buildQuote({ ...base, basePriceMinor: 0 })).toThrow(QuoteError);
  });

  it('caps stay length', () => {
    expect(() => buildQuote({ ...base, checkout: '2028-12-31' })).toThrow(/limited to 365/);
  });
});

describe('cancellation', () => {
  const moderate = getCancellationPolicy('moderate');
  const input = {
    checkin: '2026-12-10',
    paidMinor: 50000,
    nightlySubtotalMinor: 45000,
    policy: moderate,
  };

  it('refunds in full well before check-in', () => {
    const result = calculateRefund({ ...input, now: new Date('2026-11-20T00:00:00Z') });
    expect(result.tier).toBe('full');
    expect(result.refundMinor).toBe(50000);
  });

  it('refunds half the nightly subtotal inside the partial window', () => {
    // 3 days before check-in: outside the 5-day full window, inside the 48h partial one.
    const result = calculateRefund({ ...input, now: new Date('2026-12-07T00:00:00Z') });
    expect(result.tier).toBe('partial');
    expect(result.refundMinor).toBe(22500);
  });

  it('refunds nothing inside 48 hours', () => {
    const result = calculateRefund({ ...input, now: new Date('2026-12-09T12:00:00Z') });
    expect(result.tier).toBe('none');
    expect(result.refundMinor).toBe(0);
  });

  it('never refunds more than was paid', () => {
    const result = calculateRefund({
      ...input,
      paidMinor: 1000,
      now: new Date('2026-11-20T00:00:00Z'),
    });
    expect(result.refundMinor).toBe(1000);
  });

  it('uses the snapshot, not the current registry', () => {
    // A booking created under a 3-day free-cancellation policy keeps it even
    // though the current "moderate" policy requires 5 days.
    const oldSnapshot = snapshotPolicy({ ...moderate, fullRefundHours: 24 * 3, version: 7 });
    const oldPolicy = policyFromSnapshot('moderate', oldSnapshot);

    const atFourDaysOut = new Date('2026-12-06T00:00:00Z'); // 96h before check-in

    expect(calculateRefund({ ...input, policy: moderate, now: atFourDaysOut }).tier).toBe(
      'partial',
    );

    const result = calculateRefund({ ...input, policy: oldPolicy, now: atFourDaysOut });
    expect(result.tier).toBe('full');
    expect(oldPolicy.version).toBe(7);
  });
});

describe('settlement', () => {
  it('deducts the processing fee before splitting', () => {
    const s = computeSettlement({ totalMinor: 35000, split: DEFAULT_SPLIT, hasHost: true });
    expect(s.processingFeeMinor).toBe(estimateProcessingFee(35000));
    expect(s.settlementBaseMinor).toBe(35000 - s.processingFeeMinor);
    expect(
      s.ownerAmountMinor + s.hostAmountMinor + s.platformAmountMinor,
    ).toBe(s.settlementBaseMinor);
  });

  it('reconciles exactly to the settlement base', () => {
    for (const total of [100, 1000, 50000, 1234567]) {
      const s = computeSettlement({ totalMinor: total, split: DEFAULT_SPLIT, hasHost: true });
      expect(s.ownerAmountMinor + s.hostAmountMinor + s.platformAmountMinor).toBe(
        s.settlementBaseMinor,
      );
      expect(s.settlementBaseMinor + s.processingFeeMinor).toBe(total);
      expect(s.ownerAmountMinor).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives the host share to the owner when no host is assigned', () => {
    const withHost = computeSettlement({ totalMinor: 50000, split: DEFAULT_SPLIT, hasHost: true });
    const without = computeSettlement({ totalMinor: 50000, split: DEFAULT_SPLIT, hasHost: false });
    expect(without.hostAmountMinor).toBe(0);
    expect(without.ownerAmountMinor).toBe(
      withHost.ownerAmountMinor + withHost.hostAmountMinor,
    );
    expect(without.platformAmountMinor).toBe(withHost.platformAmountMinor);
  });

  it('keeps percentages summing to 100', () => {
    const s = computeSettlement({ totalMinor: 50000, split: DEFAULT_SPLIT, hasHost: true });
    expect(s.ownerPct + s.hostPct + s.platformPct).toBe(100);
  });
});

describe('processing fee estimate', () => {
  it('applies basis points plus the fixed component', () => {
    // 2.90% of 10,000 = 290, plus 30 fixed.
    expect(estimateProcessingFee(10000, { bps: 290, fixedMinor: 30 })).toBe(320);
  });

  it('never consumes more than half the charge', () => {
    const tiny = estimateProcessingFee(100, { bps: 290, fixedMinor: 30 });
    expect(tiny).toBeLessThanOrEqual(50);
  });

  it('is zero for a zero charge', () => {
    expect(estimateProcessingFee(0)).toBe(0);
  });

  it('protects the platform share on small bookings', () => {
    // A 3% platform fee on 1,000 minor units is 30; the estimated fee is larger,
    // which is exactly the margin problem the estimate exists to expose.
    const s = computeSettlement({
      totalMinor: 1000,
      split: DEFAULT_SPLIT,
      hasHost: false,
      feeConfig: { bps: 290, fixedMinor: 30 },
    });
    expect(s.processingFeeMinor).toBeGreaterThan((1000 * 3) / 100);
    expect(s.settlementBaseMinor).toBe(1000 - s.processingFeeMinor);
  });

  it('never distributes collected tax', () => {
    const total = 100000;
    const tax = 10000;
    const s = computeSettlement({
      totalMinor: total,
      taxMinor: tax,
      split: DEFAULT_SPLIT,
      hasHost: true,
    });

    expect(s.taxMinor).toBe(tax);
    expect(s.settlementBaseMinor).toBe(total - tax - s.processingFeeMinor);
    expect(
      s.ownerAmountMinor + s.hostAmountMinor + s.platformAmountMinor,
    ).toBe(s.settlementBaseMinor);
  });

  it('estimates the fee on the pre-tax amount', () => {
    const withoutTax = computeSettlement({ totalMinor: 100000, split: DEFAULT_SPLIT, hasHost: false });
    const withTax = computeSettlement({
      totalMinor: 100000,
      taxMinor: 20000,
      split: DEFAULT_SPLIT,
      hasHost: false,
    });
    // Fee is charged on 80,000 rather than 100,000, so it is strictly smaller.
    expect(withTax.processingFeeMinor).toBeLessThan(withoutTax.processingFeeMinor);
  });

  it('rejects tax larger than the charge', () => {
    expect(() =>
      computeSettlement({ totalMinor: 1000, taxMinor: 2000, split: DEFAULT_SPLIT, hasHost: false }),
    ).toThrow(/Tax exceeds/);
  });

  it('accepts an explicit fee override', () => {
    const s = computeSettlement({
      totalMinor: 10000,
      split: DEFAULT_SPLIT,
      hasHost: false,
      processingFeeMinor: 500,
    });
    expect(s.processingFeeMinor).toBe(500);
    expect(s.settlementBaseMinor).toBe(9500);
  });
});

