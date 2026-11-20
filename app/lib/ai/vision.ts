/**
 * Property vision task (spec §9).
 *
 * Turns a set of image URLs into a schema-validated `VisionAnalysisResponse`
 * through the `aiJson` boundary. No pricing decisions happen here — the model
 * returns classifications, and money is computed by `app/lib/pricing/refine.ts`.
 */

import { aiJson, type AiJsonResult } from '@/app/lib/ai/structured';
import { visionAnalysisSchema, VISION_SCHEMA_VERSION } from '@/app/lib/ai/schemas';
import type { VisionAnalysisResponse } from '@/app/core/entities';

/** Image budget per analysis. Overridable by `VISION_MAX_IMAGES`. */
export function visionMaxImages(): number {
  const configured = Number(process.env.VISION_MAX_IMAGES ?? '6');
  if (!Number.isFinite(configured) || configured < 1) return 6;
  return Math.min(12, Math.trunc(configured));
}

const VISION_PROMPT = `Analyze these property photographs for a co-hosting marketplace and return a JSON object with exactly this shape:

{
  "conditionScore": number 1-10 (overall condition),
  "interiorModernity": number 1-10 (how modern or updated the interior is),
  "curbAppeal": number 1-10 (exterior attractiveness),
  "qualityTier": "Luxury" | "Premium" | "Standard" | "Economy",
  "highlights": string[] (at most 5 key selling points visible in the photos),
  "redFlags": string[] (at most 5 visible concerns),
  "reasoning": string (short justification grounded in what is visible),
  "confidence": number 0-1 (your confidence in this assessment)
}

Guidelines:
- Judge only what is visible. Do not infer location, price or amenities you cannot see.
- Consider structure, maintenance, updates, cleanliness, layout and lighting.
- Luxury: high-end finishes, designer touches, exceptional condition.
- Premium: well maintained, modern updates, quality materials.
- Standard: functional, average condition, some dated elements.
- Economy: visible wear or repair needs.
- If the images are unusable, set low confidence rather than guessing.
- Return only the JSON object.`;

/**
 * Normalizes harmless model quirks before validation: numeric strings,
 * out-of-range scores. Deliberately does not fill in missing fields.
 */
export function coerceVisionScores(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value;
  const candidate = { ...(value as Record<string, unknown>) };

  for (const key of ['conditionScore', 'interiorModernity', 'curbAppeal', 'confidence'] as const) {
    const raw = candidate[key];
    if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
      candidate[key] = Number(raw);
    }
    const numeric = candidate[key];
    if (typeof numeric === 'number' && Number.isFinite(numeric)) {
      candidate[key] = key === 'confidence'
        ? Math.max(0, Math.min(1, numeric))
        : Math.max(1, Math.min(10, numeric));
    }
  }

  if (typeof candidate.qualityTier === 'string') {
    const normalized = candidate.qualityTier.trim().toLowerCase();
    const match: Record<string, string> = {
      luxury: 'Luxury',
      premium: 'Premium',
      standard: 'Standard',
      mid_range: 'Standard',
      economy: 'Economy',
      budget: 'Economy',
    };
    candidate.qualityTier = match[normalized] ?? candidate.qualityTier;
  }

  return candidate;
}

export interface VisionAnalysisResult {
  analysis: VisionAnalysisResponse;
  meta: {
    provider: string;
    model: string;
    attempts: number;
    latencyMs: number;
    schemaVersion: number;
    imageCount: number;
  };
}

export async function analyzePropertyPhotos(
  imageUrls: string[],
  options: { customPrompt?: string; maxImages?: number } = {},
): Promise<VisionAnalysisResult> {
  if (!imageUrls || imageUrls.length === 0) {
    throw new Error('At least one image URL is required');
  }

  const images = imageUrls.slice(0, options.maxImages ?? visionMaxImages());

  const result: AiJsonResult<VisionAnalysisResponse> = await aiJson({
    task: 'property_vision',
    prompt: options.customPrompt ?? VISION_PROMPT,
    schema: visionAnalysisSchema,
    images,
    coerce: coerceVisionScores,
  });

  return {
    analysis: result.data,
    meta: {
      provider: result.provider,
      model: result.model,
      attempts: result.attempts,
      latencyMs: result.latencyMs,
      schemaVersion: VISION_SCHEMA_VERSION,
      imageCount: images.length,
    },
  };
}
