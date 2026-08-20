/**
 * OpenRouter Adapter for Clean Architecture
 * adapts the OpenRouter AI service to the core use case interfaces
 */

import { type VisionAnalysisResponse } from '@/app/core/entities';
import { analyzePropertyPhotos, getOpenRouterConfig, getSupabasePublicUrl, type OpenRouterConfig } from '@/app/lib/ai/openrouter';

export interface OpenRouterPort {
  config: OpenRouterConfig;
  healthCheck: () => Promise<{ healthy: boolean; model: string; message: string }>;
  analyzePhotos: (imageUrls: string[], customPrompt?: string) => Promise<VisionAnalysisResponse>;
  getSupabasePublicUrl: (bucket: string, path: string) => string;
  convertStoragePathsToUrls: (paths: string[], bucket?: string) => string[];
}

/**
 * Creates an OpenRouter port adapter using the existing lib/ai/openrouter module.
 * This preserves the existing AI behavior while fitting the clean architecture port interface.
 */
export function createOpenRouterAdapter(): OpenRouterPort {
  return {
    config: getOpenRouterConfig(),
    healthCheck: async () => {
      const result = await checkOpenRouterHealth();
      return {
        healthy: result.healthy,
        model: result.model,
        message: result.message,
      };
    },
    analyzePhotos: async (imageUrls: string[], customPrompt?) => {
      if (!imageUrls || imageUrls.length === 0) {
        throw new Error('At least one image URL is required');
      }
      const prompt = customPrompt || buildVisionPrompt();
      return analyzePropertyPhotos(imageUrls, customPrompt);
    },
    getSupabasePublicUrl: (bucket, path) => getSupabasePublicUrl(bucket, path),
    convertStoragePathsToUrls: (paths, bucket = 'property-photos') => convertStoragePathsToUrls(paths, bucket),
  };
}

/**
 * Builds the vision analysis prompt (extracted from openrouter.ts for adapter use)
 */
function buildVisionPrompt(): string {
  return `You are an expert property inspector analyzing photos for a co-hosting marketplace.
Analyze the provided property photos and return a JSON object with the following structure:

{
  "conditionScore": number (1-10, overall property condition),
  "interiorModernity": number (1-10, how modern/updated the interior is),
  "curbAppeal": number (1-10, exterior attractiveness),
  "qualityTier": "Luxury" | "Premium" | "Standard" | "Economy",
  "highlights": string[] (key selling points, max 5),
  "redFlags": string[] (structural/aesthetic concerns, max 5),
  "reasoning": string (detailed analysis explanation),
  "confidence": number (0-1, your confidence in this assessment)
}

Guidelines:
- Be objective and specific
- Focus on visible evidence in photos
- Consider: structural integrity, maintenance, updates, cleanliness, layout, lighting, outdoor space
- Luxury: High-end finishes, premium appliances, designer touches, exceptional condition
- Premium: Well-maintained, modern updates, quality materials, above average
- Standard: Average condition, functional but dated, minor wear visible
- Economy: Significant wear, outdated, needs repairs/updates, budget-friendly

Return ONLY the JSON object, no additional text.`;
}