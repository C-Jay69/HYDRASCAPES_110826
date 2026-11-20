import { describe, it, expect } from 'vitest';
import {
  visionAdjustmentPct,
  applyVisionAdjustment,
} from '../app/lib/pricing/refine';

describe('visionAdjustmentPct', () => {
  it('is neutral at the score midpoint', () => {
    expect(visionAdjustmentPct(5.5, 'Standard', 15)).toBe(0);
  });

  it('never exceeds the configured cap, either direction', () => {
    for (const score of [1, 2, 5, 8, 9.9, 10]) {
      const pct = visionAdjustmentPct(score, 'Luxury', 15);
      expect(pct).toBeGreaterThanOrEqual(-15);
      expect(pct).toBeLessThanOrEqual(15);
    }
  });

  it('moves up for good condition and down for poor condition', () => {
    expect(visionAdjustmentPct(10, 'Standard', 15)).toBeGreaterThan(0);
    expect(visionAdjustmentPct(1, 'Standard', 15)).toBeLessThan(0);
  });

  it('clamps out-of-range scores instead of trusting them', () => {
    expect(visionAdjustmentPct(99, 'Standard', 15)).toBe(
      visionAdjustmentPct(10, 'Standard', 15),
    );
    expect(visionAdjustmentPct(Number.NaN, 'Standard', 15)).toBe(0);
  });

  it('returns 0 when the cap is 0', () => {
    expect(visionAdjustmentPct(10, 'Luxury', 0)).toBe(0);
  });
});

describe('applyVisionAdjustment', () => {
  const base = { basePriceMinor: 15000, maxContributionPct: 15 };

  it('returns an integer in minor units', () => {
    const result = applyVisionAdjustment({ ...base, conditionScore: 8.3, qualityTier: 'Premium' });
    expect(Number.isInteger(result)).toBe(true);
    expect(result).toBeGreaterThan(0);
  });

  it('stays within the configured percentage of the base price', () => {
    for (const score of [1, 3, 5.5, 8, 10]) {
      const result = applyVisionAdjustment({ ...base, conditionScore: score, qualityTier: 'Standard' });
      const deltaPct = Math.abs(((result - base.basePriceMinor) / base.basePriceMinor) * 100);
      expect(deltaPct).toBeLessThanOrEqual(base.maxContributionPct + 0.01);
    }
  });

  it('respects the owner price band', () => {
    const result = applyVisionAdjustment({
      ...base,
      conditionScore: 10,
      qualityTier: 'Luxury',
      minPriceMinor: 14000,
      maxPriceMinor: 15200,
    });
    expect(result).toBeLessThanOrEqual(15200);
    expect(result).toBeGreaterThanOrEqual(14000);
  });

  it('never returns zero or negative for a valid base', () => {
    const result = applyVisionAdjustment({ ...base, conditionScore: 1, qualityTier: 'Economy' });
    expect(result).toBeGreaterThan(0);
  });

  it('returns 0 for an invalid base price rather than inventing one', () => {
    expect(applyVisionAdjustment({ ...base, basePriceMinor: 0, conditionScore: 8 })).toBe(0);
    expect(applyVisionAdjustment({ ...base, basePriceMinor: -100, conditionScore: 8 })).toBe(0);
  });

  it('is deterministic', () => {
    const input = { ...base, conditionScore: 7.77, qualityTier: 'Premium' as const };
    expect(applyVisionAdjustment(input)).toBe(applyVisionAdjustment(input));
  });
});
