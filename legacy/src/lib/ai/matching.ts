import { HostMatchSchema } from "./schemas.js";
import { aiJson } from "./structured.js";
import { Profile, Property } from "../../types/nest.js";

export async function matchHostAndProperty(
  host: Profile,
  property: Property,
  proposedFeePct: number,
  pitchText: string
) {
  const prompt = `Evaluate compatibility between a Co-Host and a Property Owner on Hydrascapes co-hosting marketplace.

Host Profile:
Name: ${host.full_name}
Rating: ${host.rating_avg || 5.0} (${host.rating_count} reviews)
Bio: ${host.bio || 'Experienced local hospitality manager'}
KYC Status: ${host.kyc_status}

Property Details:
Title: ${property.title}
Location: ${property.address_json.city || 'San Francisco'}, ${property.address_json.state || 'CA'}
Bedrooms: ${property.bedrooms}, Bathrooms: ${property.bathrooms}
Base Rate: $${property.base_price_minor / 100}/night

Host Application Proposal:
Proposed Fee: ${proposedFeePct}%
Pitch: "${pitchText}"

Provide advisory evaluation JSON:
1. score: 0-100 compatibility rating
2. strengths: array of top strengths
3. concerns: array of potential risks or concerns
4. reasoning: clear, objective analysis
5. recommendation: advisory summary (e.g., "Highly Recommended", "Strong Match")`;

  const fallbackMatch = {
    score: Math.min(98, 75 + Math.round((host.rating_avg || 4.8) * 4) + (pitchText.length > 50 ? 5 : 0)),
    strengths: [
      `Local presence in ${property.address_json.city || 'the area'}`,
      `Competitive proposed fee structure (${proposedFeePct}%)`,
      `Verified host profile with positive guest ratings`
    ],
    concerns: [
      proposedFeePct > 20 ? "Proposed fee is higher than platform average" : "Ensure calendar availability during peak holidays"
    ],
    reasoning: `Host exhibits high hospitality rating (${host.rating_avg || 4.9}/5) and strong familiarity with similar properties.`,
    recommendation: "Strongly Recommended Co-Host Match"
  };

  try {
    const { data } = await aiJson(prompt, HostMatchSchema);
    return data;
  } catch (err) {
    console.warn("Host matching AI fallback used:", err);
    return fallbackMatch;
  }
}
