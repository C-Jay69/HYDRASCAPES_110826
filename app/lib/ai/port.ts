/**
 * The AI port consumed by core use cases (spec §8).
 *
 * Core code depends on this interface, never on a vendor module. The concrete
 * implementation lives in `infrastructure/ai/`.
 */

import type { VisionAnalysisResponse } from '@/app/core/entities';

export interface VisionAnalysisMeta {
  provider: string;
  model: string;
  attempts: number;
  latencyMs: number;
  schemaVersion: number;
  imageCount: number;
}

export interface AiPort {
  /** False when no provider is configured; AI work is skipped, not failed. */
  isConfigured: () => boolean;
  /** Model id for audit records. Metadata only. */
  getModel: () => string;
  healthCheck: () => Promise<{ healthy: boolean; model: string; message: string }>;
  analyzePhotos: (
    imageUrls: string[],
    options?: { customPrompt?: string; maxImages?: number },
  ) => Promise<{ analysis: VisionAnalysisResponse; meta: VisionAnalysisMeta }>;
}
