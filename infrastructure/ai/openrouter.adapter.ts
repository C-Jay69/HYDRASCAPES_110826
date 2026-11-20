/**
 * AI adapter (spec §8).
 *
 * Wires the provider-agnostic port to whatever provider the environment
 * configures. Despite the historical filename there is nothing
 * OpenRouter-specific here: `AI_BASE_URL` and `AI_MODEL` decide the
 * destination, and fallbacks are honoured by `aiJson`.
 */

import { analyzePropertyPhotos } from '@/app/lib/ai/vision';
import { activeProvider, AiUnavailableError } from '@/app/lib/ai/structured';
import { isAiConfigured } from '@/app/lib/ai/provider';
import type { AiPort } from '@/app/lib/ai/port';

export function createAiAdapter(): AiPort {
  return {
    isConfigured: () => isAiConfigured(),

    getModel: () => activeProvider()?.model ?? 'unconfigured',

    async healthCheck() {
      const provider = activeProvider();
      if (!provider) {
        return {
          healthy: false,
          model: 'unconfigured',
          message: 'No AI provider is configured (AI_API_KEY / OPENROUTER_API_KEY missing)',
        };
      }

      try {
        const completion = await provider.complete(
          [{ role: 'user', content: 'Reply with the single word: ok' }],
          { maxTokens: 5, timeoutMs: 10_000 },
        );
        return {
          healthy: true,
          model: provider.model,
          message: `Provider ${provider.id} responded: ${completion.content.slice(0, 40)}`,
        };
      } catch (error) {
        return {
          healthy: false,
          model: provider.model,
          message: error instanceof Error ? error.message : 'Unknown provider error',
        };
      }
    },

    async analyzePhotos(imageUrls, options) {
      if (!isAiConfigured()) throw new AiUnavailableError();
      return analyzePropertyPhotos(imageUrls, options);
    },
  };
}

/** @deprecated Use `createAiAdapter`; kept so older imports keep compiling. */
export const createOpenRouterAdapter = createAiAdapter;
