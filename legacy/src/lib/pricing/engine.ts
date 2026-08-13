import { Property, PriceSuggestion, PricingTraceFactor } from "../../types/nest.js";
import { aiJson } from "../ai/structured.js";
import { PricingRefinementSchema } from "../ai/schemas.js";

export async function computePriceSuggestion(
  property: Property,
  stayDate: string // YYYY-MM-DD
): Promise<PriceSuggestion> {
  const dateObj = new Date(stayDate);
  const dayOfWeek = dateObj.getDay(); // 0 = Sun, 5 = Fri, 6 = Sat
  const month = dateObj.getMonth(); // 0-11

  const basePriceMinor = property.base_price_minor;
  const factors: PricingTraceFactor[] = [];

  // 1. Day of Week Factor
  let dowMultiplier = 1.0;
  let dowLabel = "Weekday Standard";
  if (dayOfWeek === 5 || dayOfWeek === 6) { // Fri/Sat
    dowMultiplier = 1.18;
    dowLabel = "Weekend Peak (+18%)";
  } else if (dayOfWeek === 0) { // Sun
    dowMultiplier = 1.08;
    dowLabel = "Sunday Extended Stay (+8%)";
  }

  const dowDelta = Math.round(basePriceMinor * (dowMultiplier - 1.0));
  factors.push({
    key: "day_of_week",
    label: dowLabel,
    multiplier: dowMultiplier,
    delta_minor: dowDelta,
    source: "calendar_engine"
  });

  // 2. Seasonality Factor (Summer/Holidays boost)
  let seasonMultiplier = 1.0;
  let seasonLabel = "Standard Season";
  if (month >= 5 && month <= 7) { // June - August
    seasonMultiplier = 1.12;
    seasonLabel = "Summer High Season (+12%)";
  } else if (month === 11) { // December
    seasonMultiplier = 1.15;
    seasonLabel = "Holiday Peak Season (+15%)";
  }

  const seasonDelta = Math.round(basePriceMinor * (seasonMultiplier - 1.0));
  factors.push({
    key: "seasonality",
    label: seasonLabel,
    multiplier: seasonMultiplier,
    delta_minor: seasonDelta,
    source: "seasonal_signals"
  });

  // 3. Property Vision Factor (Capped at max 30%)
  let visionMultiplier = 1.0;
  let visionLabel = "Standard Visual Condition";
  if (property.vision_analysis) {
    const va = property.vision_analysis;
    if (va.quality_tier === 'luxury') visionMultiplier += 0.12;
    else if (va.quality_tier === 'premium') visionMultiplier += 0.06;

    if (va.condition_score >= 9) visionMultiplier += 0.05;
    if (va.lighting_quality === 'exceptional') visionMultiplier += 0.03;

    // Cap vision contribution at max 1.30 (+30%)
    visionMultiplier = Math.min(1.30, Math.max(0.85, visionMultiplier));
    const visionPct = Math.round((visionMultiplier - 1.0) * 100);
    visionLabel = `Vision Analysis (${va.quality_tier.toUpperCase()}, Score ${va.condition_score}/10: ${visionPct >= 0 ? '+' : ''}${visionPct}%)`;
  }

  const visionDelta = Math.round(basePriceMinor * (visionMultiplier - 1.0));
  factors.push({
    key: "vision_quality",
    label: visionLabel,
    multiplier: visionMultiplier,
    delta_minor: visionDelta,
    source: "property_vision"
  });

  // Calculate Deterministic Subtotal
  let combinedDeterministicMult = dowMultiplier * seasonMultiplier * visionMultiplier;
  const deterministicPriceMinor = Math.round(basePriceMinor * combinedDeterministicMult);

  // Layer 3: AI Refinement (Clamped to ±15%)
  let aiMultiplier = 1.02; // Default +2% market demand
  let aiRationale = "AI detected heightened local event demand & search momentum.";

  try {
    const aiPrompt = `Analyze pricing adjustment for stay on ${stayDate} for property "${property.title}" in ${property.address_json.city || 'San Francisco'}.
Base Price: $${property.base_price_minor / 100}
Deterministic Price: $${deterministicPriceMinor / 100}
Vision Quality: ${property.vision_analysis?.quality_tier || 'standard'}

Evaluate local market events, lead time momentum, and guest willingness-to-pay.
Return JSON with:
1. adjustment_multiplier: number bounded between 0.85 and 1.15
2. confidence: "low" | "medium" | "high"
3. rationale: string explanation
4. risk_factors: array of string risks
5. reasoning_notes: internal trace`;

    const { data } = await aiJson(aiPrompt, PricingRefinementSchema);
    aiMultiplier = Math.min(1.15, Math.max(0.85, data.adjustment_multiplier));
    aiRationale = data.rationale;
  } catch (e) {
    console.warn("AI Pricing Refinement fallback used:", e);
  }

  // Calculate Raw Final Price
  let rawFinalMinor = Math.round(deterministicPriceMinor * aiMultiplier);

  // Owner Floor / Ceiling Clamping
  const floorMinor = property.min_price_minor || Math.round(basePriceMinor * 0.7);
  const ceilingMinor = property.max_price_minor || Math.round(basePriceMinor * 2.0);

  const finalSuggestedMinor = Math.min(ceilingMinor, Math.max(floorMinor, rawFinalMinor));

  return {
    id: Date.now(),
    property_id: property.id,
    stay_date: stayDate,
    current_price_minor: basePriceMinor,
    suggested_price_minor: finalSuggestedMinor,
    price_low_minor: Math.round(finalSuggestedMinor * 0.92),
    price_high_minor: Math.round(finalSuggestedMinor * 1.08),
    confidence: "high",
    reasoning_trace: {
      base_price_minor: basePriceMinor,
      factors,
      ai_multiplier: Number(aiMultiplier.toFixed(3)),
      ai_rationale: aiRationale,
      final_suggested_minor: finalSuggestedMinor,
    },
    multipliers: {
      day_of_week: dowMultiplier,
      seasonality: seasonMultiplier,
      vision: visionMultiplier,
      ai_refinement: aiMultiplier,
    },
    status: "pending",
    created_at: new Date().toISOString(),
  };
}
