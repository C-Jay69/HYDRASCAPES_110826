import { z } from "zod";

export const VisionAnalysisSchema = z.object({
  quality_tier: z.enum(['budget', 'mid_range', 'premium', 'luxury']),
  condition_score: z.number().min(1).max(10),
  interior_modernity_score: z.number().min(1).max(10),
  curb_appeal_score: z.number().min(1).max(10),
  notable_features: z.array(z.string()),
  red_flags: z.array(z.string()),
  aesthetic_vibe: z.enum([
    'cozy_rustic',
    'modern_minimalist',
    'coastal_breeze',
    'urban_industrial',
    'luxury_estate',
    'classic_warmth'
  ]),
  estimated_size_bracket: z.enum(['compact', 'medium', 'spacious', 'palatial']),
  lighting_quality: z.enum(['poor', 'adequate', 'bright_natural', 'exceptional']),
  visual_justification: z.string(),
  confidence: z.enum(['low', 'medium', 'high']),
  highlights: z.array(z.string()).optional(),
});

export const HostMatchSchema = z.object({
  score: z.number().min(0).max(100),
  strengths: z.array(z.string()),
  concerns: z.array(z.string()),
  reasoning: z.string(),
  recommendation: z.string(),
});

export const PricingRefinementSchema = z.object({
  adjustment_multiplier: z.number().min(0.85).max(1.15),
  confidence: z.enum(['low', 'medium', 'high']),
  rationale: z.string(),
  risk_factors: z.array(z.string()),
  reasoning_notes: z.string(),
});

export const DisputeAssessmentSchema = z.object({
  damage_detected: z.boolean(),
  severity: z.enum(['low', 'medium', 'high', 'severe']),
  itemised_findings: z.array(z.string()),
  evidence_quality: z.enum(['low', 'medium', 'high']),
  recommended_award_pct: z.number().min(0).max(100),
  rationale: z.string(),
  requires_human_review: z.boolean(),
});
