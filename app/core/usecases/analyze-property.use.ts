import type { PropertyGateway } from '@/infrastructure/db/property.gateway';
import type { VisionAnalysisResponse } from '@/app/core/entities';
import type { AiPort } from '@/app/lib/ai/port';
import { applyVisionAdjustment, visionContributionCapPct } from '@/app/lib/pricing/refine';

/**
 * Resolves private storage object paths to short-lived URLs the model can
 * fetch. Implemented in `app/lib/storage/signed-urls.ts`.
 */
export interface PhotoUrlResolver {
  signedUrls: (bucket: string, paths: string[]) => Promise<string[]>;
}

export interface AnalyzePropertyInput {
  propertyId: string;
  /** Re-run even when the photo set is unchanged. Internal/operational use. */
  force?: boolean;
}

export interface AnalyzePropertyOutput {
  analysis: VisionAnalysisResponse;
  /** True when the stored analysis already matched this photo set. */
  skipped: boolean;
  property: {
    id: string;
    title: string;
    basePriceMinor: number;
    suggestedPriceMinor: number;
    currency: string;
    visionStatus: string;
  };
}

const BUCKET = 'property-photos';
/** Images per request. Kept small: more images means more latency and cost. */
const MAX_IMAGES = 6;

/** Deterministic fingerprint of the analysed photo set (spec §9). */
async function hashPhotoSet(paths: string[]): Promise<string> {
  const canonical = [...paths].sort().join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export class AnalyzePropertyUseCase {
  private propertyGateway: PropertyGateway;
  private aiPort: AiPort;
  private photoUrls: PhotoUrlResolver;

  constructor(
    propertyGateway: PropertyGateway,
    aiPort: AiPort,
    photoUrls: PhotoUrlResolver,
  ) {
    this.propertyGateway = propertyGateway;
    this.aiPort = aiPort;
    this.photoUrls = photoUrls;
  }

  async execute(input: AnalyzePropertyInput): Promise<AnalyzePropertyOutput> {
    if (!this.aiPort.isConfigured()) {
      throw new Error('AI provider is not configured');
    }

    const property = await this.propertyGateway.getById(input.propertyId);
    if (!property) {
      throw new Error('Property not found');
    }

    // Photo set: gallery paths plus the cover, de-duplicated, order preserved.
    const photoPaths = Array.from(
      new Set(
        [...(Array.isArray(property.photos) ? property.photos : []), property.cover_photo]
          .filter((path): path is string => typeof path === 'string' && path.length > 0),
      ),
    );

    if (photoPaths.length === 0) {
      throw new Error('No property photos found for analysis');
    }

    const photosHash = await hashPhotoSet(photoPaths);
    const unchanged =
      !input.force &&
      property.vision_status === 'complete' &&
      property.vision_photos_hash === photosHash;

    const basePriceMinor = Number(property.base_price_minor ?? 0);
    const capPct = visionContributionCapPct();

    if (unchanged) {
      const stored = property.vision_analysis as Partial<VisionAnalysisResponse>;
      return {
        analysis: stored as VisionAnalysisResponse,
        skipped: true,
        property: {
          id: property.id,
          title: property.title,
          basePriceMinor,
          suggestedPriceMinor: applyVisionAdjustment({
            basePriceMinor,
            conditionScore: Number(stored.conditionScore ?? 5.5),
            qualityTier: stored.qualityTier,
            maxContributionPct: capPct,
            minPriceMinor: Number(property.min_price_minor ?? 0),
            maxPriceMinor: Number(property.max_price_minor ?? 0),
          }),
          currency: property.currency,
          visionStatus: property.vision_status,
        },
      };
    }

    // Signed URLs: the buckets are private, so a public URL would 404 for the model.
    const imageUrls = (
      await this.photoUrls.signedUrls(BUCKET, photoPaths.slice(0, MAX_IMAGES))
    ).filter(Boolean);

    if (imageUrls.length === 0) {
      await this.propertyGateway.updateVisionAnalysis(
        input.propertyId,
        { error: 'no_readable_images' },
        'failed',
        { photosHash },
      );
      throw new Error('No readable property photos found for analysis');
    }

    await this.propertyGateway.updateVisionAnalysis(
      input.propertyId,
      property.vision_analysis ?? {},
      'processing',
      { model: this.aiPort.getModel(), photosHash },
    );

    try {
      const { analysis, meta } = await this.aiPort.analyzePhotos(imageUrls, {
        maxImages: MAX_IMAGES,
      });

      await this.propertyGateway.updateVisionAnalysis(
        input.propertyId,
        {
          ...analysis,
          provider: meta.provider,
          model: meta.model,
          schema_version: meta.schemaVersion,
          analyzed_at: new Date().toISOString(),
        },
        'complete',
        {
          model: meta.model,
          schemaVersion: meta.schemaVersion,
          photosHash,
        },
      );

      // Money is computed here, in TypeScript, never by the model (spec §2).
      const suggestedPriceMinor = applyVisionAdjustment({
        basePriceMinor,
        conditionScore: analysis.conditionScore,
        qualityTier: analysis.qualityTier,
        maxContributionPct: capPct,
        minPriceMinor: Number(property.min_price_minor ?? 0),
        maxPriceMinor: Number(property.max_price_minor ?? 0),
      });

      return {
        analysis,
        skipped: false,
        property: {
          id: property.id,
          title: property.title,
          basePriceMinor,
          suggestedPriceMinor,
          currency: property.currency,
          visionStatus: 'complete',
        },
      };
    } catch (error) {
      // A failed analysis must not block the listing (spec §1, §9).
      await this.propertyGateway.updateVisionAnalysis(
        input.propertyId,
        {
          error: error instanceof Error ? error.message.slice(0, 500) : 'unknown_error',
          failed_at: new Date().toISOString(),
        },
        'failed',
        { model: this.aiPort.getModel(), photosHash },
      );
      throw error;
    }
  }
}
