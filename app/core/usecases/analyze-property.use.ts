import type { PropertyGateway } from '@/infrastructure/db/property.gateway';
import type { VisionAnalysisResponse } from '@/app/core/entities';
import type { OpenRouterPort } from '@/infrastructure/ai/openrouter.adapter';

export interface AnalyzePropertyInput {
  propertyId: string;
}

export interface AnalyzePropertyOutput {
  analysis: VisionAnalysisResponse;
  property: {
    id: string;
    title: string;
    basePriceMinor: number;
    currency: string;
    visionStatus: string;
  };
}

export class AnalyzePropertyUseCase {
  private propertyGateway: PropertyGateway;
  private aiPort: OpenRouterPort;

  constructor(
    propertyGateway: PropertyGateway,
    aiPort: OpenRouterPort
  ) {
    this.propertyGateway = propertyGateway;
    this.aiPort = aiPort;
  }

  async execute(input: AnalyzePropertyInput): Promise<AnalyzePropertyOutput> {
    // Fetch property details including photo paths
    const property = await this.propertyGateway.getById(input.propertyId);

    if (!property) {
      throw new Error('Property not found');
    }

    // Get photo paths and convert to public URLs
    const photoPaths = Array.isArray(property.photos) ? property.photos : [];
    const imageUrls = photoPaths.map((path: string) => this.aiPort.getSupabasePublicUrl('property-photos', path));

    // Add cover photo if it's different from the photos array
    if (property.cover_photo && !imageUrls.includes(property.cover_photo)) {
      imageUrls.unshift(this.aiPort.getSupabasePublicUrl('property-photos', property.cover_photo));
    }

    if (imageUrls.length === 0) {
      throw new Error('No property photos found for analysis');
    }

    // Maximum images to analyze
    const MAX_IMAGES = 6;
    const imagesToAnalyze = imageUrls.slice(0, MAX_IMAGES);

    // Perform AI vision analysis
    const analysis: VisionAnalysisResponse = await this.aiPort.analyzePhotos(imagesToAnalyze);

    // Update property record with analysis results
    await this.propertyGateway.updateVisionAnalysis(input.propertyId, {
      condition_score: analysis.conditionScore,
      interior_modernity: analysis.interiorModernity,
      curb_appeal: analysis.curbAppeal,
      quality_tier: analysis.qualityTier,
      highlights: analysis.highlights,
      red_flags: analysis.redFlags,
      reasoning: analysis.reasoning,
      confidence: analysis.confidence,
      model: process.env.AI_MODEL || 'openrouter',
      analyzed_at: new Date().toISOString(),
    }, 'completed' as const);

    // Calculate AI-adjusted pricing
    const basePrice = property.base_price_minor ?? 0;
    const adjustedPrice = Math.round(
      basePrice * (1 + (analysis.conditionScore / 10) * 0.15)
    );

    // Return analysis results
    return {
      analysis,
      property: {
        id: property.id,
        title: property.title,
        basePriceMinor: adjustedPrice,
        currency: property.currency,
        visionStatus: 'completed',
      },
    };
  }
}