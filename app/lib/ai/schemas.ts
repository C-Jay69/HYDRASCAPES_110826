/**
 * Zod schemas for everything that crosses a trust boundary.
 *
 * Spec §3: every structured AI response must pass a Zod schema before
 * application code may use it. Spec §8.2: `JSON.parse` of model output is
 * only allowed inside the controlled `aiJson` boundary in `../ai/openrouter.ts`.
 *
 * Validation failure means the value is untrusted and must be rejected.
 */

import { z } from 'zod';
import type { VisionAnalysisResponse } from '@/app/core/entities';

/**
 * Bump when the shape of `visionAnalysisSchema` changes in a way that makes
 * old stored analyses ambiguous. Persisted alongside every analysis in
 * `properties.vision_schema_version`.
 */
export const VISION_SCHEMA_VERSION = 1;

export const qualityTierSchema = z.enum(['Luxury', 'Premium', 'Standard', 'Economy']);

/**
 * Vision analysis. Bounded on purpose: a model that returns 900 highlights
 * or a 2 MB justification must be rejected, not stored.
 */
export const visionAnalysisSchema = z.object({
  conditionScore: z.number().finite().min(1).max(10),
  interiorModernity: z.number().finite().min(1).max(10),
  curbAppeal: z.number().finite().min(1).max(10),
  qualityTier: qualityTierSchema,
  highlights: z.array(z.string().min(1).max(200)).max(5),
  redFlags: z.array(z.string().min(1).max(200)).max(5),
  reasoning: z.string().min(1).max(2000),
  confidence: z.number().finite().min(0).max(1),
}) satisfies z.ZodType<VisionAnalysisResponse>;

/** Body accepted by `POST /api/properties`. */
export const createPropertyInputSchema = z
  .object({
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(140),
    description: z.string().trim().max(5000).optional(),
    addressJson: z.record(z.string(), z.unknown()).default({}),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    bedrooms: z.number().int().min(0).max(100),
    bathrooms: z.number().min(0).max(100),
    maxGuests: z.number().int().min(1).max(100),
    amenities: z.array(z.string().max(60)).max(50).default([]),
    basePriceMinor: z.number().int().positive(),
    minPriceMinor: z.number().int().positive().optional(),
    maxPriceMinor: z.number().int().positive().optional(),
    currency: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/, 'Currency must be an uppercase ISO-4217 code'),
    cleaningFeeMinor: z.number().int().min(0).default(0),
    photos: z.array(z.string().max(1024)).max(30).default([]),
    coverPhoto: z.string().max(1024).nullable().optional(),
  })
  .refine(
    (value) => {
      const min = value.minPriceMinor ?? value.basePriceMinor;
      const max = value.maxPriceMinor ?? value.basePriceMinor;
      return min <= value.basePriceMinor && value.basePriceMinor <= max;
    },
    { message: 'Price band must satisfy min <= base <= max' },
  );

/**
 * Body accepted by `PATCH /api/properties/[id]`.
 *
 * Every field is optional, but the result must still satisfy the price-band
 * constraint — so the route merges with the stored row before checking.
 * `status` is narrowed: owners may publish or unpublish, but they cannot set
 * `managed`/`suspended`/`pending_host`, which are operator transitions.
 */
export const updatePropertyInputSchema = z
  .object({
    title: z.string().trim().min(3).max(140).optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    addressJson: z.record(z.string(), z.unknown()).optional(),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    bedrooms: z.number().int().min(0).max(100).optional(),
    bathrooms: z.number().min(0).max(100).optional(),
    maxGuests: z.number().int().min(1).max(100).optional(),
    amenities: z.array(z.string().max(60)).max(50).optional(),
    basePriceMinor: z.number().int().positive().optional(),
    minPriceMinor: z.number().int().positive().optional(),
    maxPriceMinor: z.number().int().positive().optional(),
    currency: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/, 'Currency must be an uppercase ISO-4217 code')
      .optional(),
    cleaningFeeMinor: z.number().int().min(0).optional(),
    photos: z.array(z.string().max(1024)).max(30).optional(),
    coverPhoto: z.string().max(1024).nullable().optional(),
    status: z.enum(['draft', 'listed']).optional(),
  })
  .strict();
