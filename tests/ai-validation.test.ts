/**
 * Tests for the AI trust boundary (spec §29 `ai-validation.test.ts`).
 *
 * These cover the pure parts: JSON extraction and schema validation. No
 * network calls, no provider configuration required.
 */

import { describe, it, expect } from 'vitest';
import { parseJsonObject } from '../app/lib/ai/structured';
import { coerceVisionScores } from '../app/lib/ai/vision';
import { visionAnalysisSchema } from '../app/lib/ai/schemas';

const validAnalysis = {
  conditionScore: 8,
  interiorModernity: 7,
  curbAppeal: 6,
  qualityTier: 'Premium',
  highlights: ['Bright living room', 'Updated kitchen'],
  redFlags: [],
  reasoning: 'Visible recent renovation and good natural light.',
  confidence: 0.72,
};

describe('parseJsonObject', () => {
  it('parses a bare JSON object', () => {
    const result = parseJsonObject('{"a":1}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    const result = parseJsonObject('```json\n{"a":1}\n```');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: 1 });
  });

  it('extracts an object surrounded by prose', () => {
    const result = parseJsonObject('Sure! Here is the result: {"a":{"b":2}} Hope that helps.');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ a: { b: 2 } });
  });

  it('ignores braces inside strings', () => {
    const result = parseJsonObject('{"note":"a } brace","ok":true}');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ note: 'a } brace', ok: true });
  });

  it('reports invalid JSON instead of throwing', () => {
    const result = parseJsonObject('{"a": }');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/not valid JSON/);
  });

  it('reports a response with no object', () => {
    const result = parseJsonObject('I cannot help with that.');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/did not contain a JSON object/);
  });
});

describe('visionAnalysisSchema', () => {
  it('accepts a well-formed analysis', () => {
    expect(visionAnalysisSchema.safeParse(validAnalysis).success).toBe(true);
  });

  it('rejects an out-of-range score', () => {
    expect(visionAnalysisSchema.safeParse({ ...validAnalysis, conditionScore: 11 }).success).toBe(
      false,
    );
  });

  it('rejects an unknown quality tier', () => {
    expect(visionAnalysisSchema.safeParse({ ...validAnalysis, qualityTier: 'Nice' }).success).toBe(
      false,
    );
  });

  it('rejects unbounded arrays', () => {
    const highlights = Array.from({ length: 6 }, (_, index) => `feature ${index}`);
    expect(visionAnalysisSchema.safeParse({ ...validAnalysis, highlights }).success).toBe(false);
  });

  it('rejects a missing field rather than filling it in', () => {
    const { confidence: _confidence, ...withoutConfidence } = validAnalysis;
    expect(visionAnalysisSchema.safeParse(withoutConfidence).success).toBe(false);
  });
});

describe('coerceVisionScores', () => {
  it('clamps overshooting scores', () => {
    const coerced = coerceVisionScores({
      ...validAnalysis,
      conditionScore: 13,
      curbAppeal: -2,
      confidence: 1.4,
    }) as typeof validAnalysis;

    expect(coerced.conditionScore).toBe(10);
    expect(coerced.curbAppeal).toBe(1);
    expect(coerced.confidence).toBe(1);
  });

  it('parses numeric strings', () => {
    const coerced = coerceVisionScores({ ...validAnalysis, conditionScore: '7' }) as typeof validAnalysis;
    expect(coerced.conditionScore).toBe(7);
  });

  it('normalizes alternative tier names', () => {
    expect((coerceVisionScores({ ...validAnalysis, qualityTier: 'luxury' }) as typeof validAnalysis).qualityTier)
      .toBe('Luxury');
    expect((coerceVisionScores({ ...validAnalysis, qualityTier: 'budget' }) as typeof validAnalysis).qualityTier)
      .toBe('Economy');
  });

  it('never invents missing fields', () => {
    const coerced = coerceVisionScores({ conditionScore: 7 }) as Record<string, unknown>;
    expect(coerced.conditionScore).toBe(7);
    expect(visionAnalysisSchema.safeParse(coerced).success).toBe(false);
  });

  it('passes non-objects through unchanged', () => {
    expect(coerceVisionScores(null)).toBeNull();
    expect(coerceVisionScores('nope')).toBe('nope');
  });
});
