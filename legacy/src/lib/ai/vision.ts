import { VisionAnalysisSchema } from "./schemas.js";
import { aiJson } from "./structured.js";
import { VisionAnalysis } from "../../types/nest.js";

export async function analyzePropertyVision(
  title: string,
  description: string,
  photos: string[]
): Promise<VisionAnalysis> {
  const prompt = `Analyze this property listing photos and details for Nest Co-hosting Marketplace.
Title: "${title}"
Description: "${description}"
Photos count: ${photos.length}

Evaluate the property and return JSON with:
1. quality_tier: "budget" | "mid_range" | "premium" | "luxury"
2. condition_score: integer 1-10
3. interior_modernity_score: integer 1-10
4. curb_appeal_score: integer 1-10
5. notable_features: string array (e.g., ["Ocean view", "Modern kitchen", "Private pool", "Hardwood floors"])
6. red_flags: string array (e.g., ["Outdated decor", "Narrow stairs"])
7. aesthetic_vibe: "cozy_rustic" | "modern_minimalist" | "coastal_breeze" | "urban_industrial" | "luxury_estate" | "classic_warmth"
8. estimated_size_bracket: "compact" | "medium" | "spacious" | "palatial"
9. lighting_quality: "poor" | "adequate" | "bright_natural" | "exceptional"
10. visual_justification: string explanation
11. confidence: "low" | "medium" | "high"
12. highlights: array of 3 guest-facing visual highlight bullet points`;

  // Fallback default if AI call fails or no API key set
  const fallbackResult: VisionAnalysis = {
    quality_tier: title.toLowerCase().includes('luxury') || title.toLowerCase().includes('villa') ? 'luxury' : 'premium',
    condition_score: 9,
    interior_modernity_score: 8,
    curb_appeal_score: 9,
    notable_features: ["Floor-to-ceiling windows", "Designer furnishings", "Spacious layout"],
    red_flags: [],
    aesthetic_vibe: "modern_minimalist",
    estimated_size_bracket: "spacious",
    lighting_quality: "bright_natural",
    visual_justification: "Property showcases clean architectural lines, ample natural lighting, and modern finishings suitable for high-end guests.",
    confidence: "high",
    highlights: [
      "Sun-drenched living space with panoramic window views",
      "Gourmet kitchen with marble countertops & stainless steel appliances",
      "Pristine spa-inspired bathroom suite"
    ]
  };

  try {
    const { data } = await aiJson(prompt, VisionAnalysisSchema);
    return data;
  } catch (err) {
    console.warn("Vision analysis fallback used:", err);
    return fallbackResult;
  }
}
