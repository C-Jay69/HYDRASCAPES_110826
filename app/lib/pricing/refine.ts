/**
 * Deterministic vision-driven price refinement (spec §2, §9, §10).
 *
 * The model returns bounded classifications only. Every monetary value is
 * computed here, in plain integer arithmetic, so it is reproducible and
 * unit-testable. Nothing in this module calls a model.
 */

import type { QualityTier } from '@/app/core/entities';

/** Scores are 1-10; 5.5 is "neutral", so a mid property changes nothing. */
const SCORE_MIDPOINT = 5.5;
/** Maximum distance from the midpoint, used to normalize to [-1, 1]. */
const SCORE_SPREAD = 4.5;

export interface VisionPricingInput {
  basePriceMinor: number;
  conditionScore: number;
  qualityTier?: QualityTier;
  /** Hard cap from configuration (VISION_PRICING_MAX_CONTRIBUTION_PCT). */
  maxContributionPct: number;
  /** Owner's acceptable band, in minor units. The result never leaves it. */
  minPriceMinor?: number;
  maxPriceMinor?: number;
}

/** Small, fixed nudge for tier classification. Bounded and reviewable. */
const TIER_BONUS_PCT: Record<QualityTier, number> = {
  Luxury: 2,
  Premium: 1,
  Standard: 0,
  Economy: -1,
};

/**
 * Percentage adjustment implied by a vision result, in whole percent.
 * Always within `[-maxContributionPct, +maxContributionPct]`.
 */
export function visionAdjustmentPct(
  conditionScore: number,
  qualityTier: QualityTier | undefined,
  maxContributionPct: number,
): number {
  const cap = Math.max(0, Math.floor(maxContributionPct));
  const score = Number.isFinite(conditionScore)
    ? Math.max(1, Math.min(10, conditionScore))
    : SCORE_MIDPOINT;

  const normalized = (score - SCORE_MIDPOINT) / SCORE_SPREAD; // -1..1
  const tierBonus = qualityTier ? TIER_BONUS_PCT[qualityTier] ?? 0 : 0;
  const raw = Math.round(normalized * cap + tierBonus);

  return Math.max(-cap, Math.min(cap, raw));
}

/**
 * Applies a vision adjustment to a base price. The result is always:
 *  - a positive integer number of minor units,
 *  - inside the owner's min/max band when one is supplied,
 *  - changed by no more than `maxContributionPct`.
 */
export function applyVisionAdjustment(input: VisionPricingInput): number {
  const base = Math.trunc(input.basePriceMinor);
  if (!Number.isFinite(base) || base <= 0) return 0;

  const pct = visionAdjustmentPct(
    input.conditionScore,
    input.qualityTier,
    input.maxContributionPct,
  );

  // Integer math only: round half away from zero by using sign * floor(x + 0.5).
  const delta = base * pct;
  const adjusted = Math.sign(pct) * Math.floor((Math.abs(delta) + 50) / 100) + base;

  const min = input.minPriceMinor && input.minPriceMinor > 0 ? input.minPriceMinor : 1;
  const max = input.maxPriceMinor && input.maxPriceMinor > 0 ? input.maxPriceMinor : Number.MAX_SAFE_INTEGER;

  return Math.max(min, Math.min(max, Math.max(1, adjusted)));
}

/** Configured cap, read from env with a conservative default. */
export function visionContributionCapPct(): number {
  const raw = Number(process.env.VISION_PRICING_MAX_CONTRIBUTION_PCT ?? '15');
  if (!Number.isFinite(raw) || raw < 0) return 15;
  return Math.min(100, Math.trunc(raw));
}
