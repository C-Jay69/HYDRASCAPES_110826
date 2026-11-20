/**
 * Model-agnostic AI provider layer (spec §4, §8, §8.1).
 *
 * Application code talks to `AiProvider`, never to a vendor SDK. Provider and
 * model identifiers are configuration: swapping `AI_MODEL` must not require a
 * code change, and nothing here may assume a model stays free or available.
 *
 * The implementation speaks the OpenAI-compatible chat-completions protocol,
 * which OpenRouter, Ollama, vLLM and most gateways expose. A vendor with a
 * different protocol gets its own module implementing the same interface.
 */

export type AiRole = 'system' | 'user' | 'assistant';

export type AiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; url: string };

export interface AiChatMessage {
  role: AiRole;
  content: string | AiContentPart[];
}

export interface AiCapabilities {
  supportsVision: boolean;
  supportsStructuredOutput: boolean;
  /** Images per request we are willing to send to this provider. */
  maxImages: number;
}

export interface AiCompletionOptions {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  /** Ask the provider for a JSON object response. */
  jsonMode?: boolean;
}

export interface AiCompletion {
  content: string;
  model: string;
  usage?: { promptTokens?: number; completionTokens?: number };
}

export interface AiProvider {
  readonly id: string;
  readonly model: string;
  readonly capabilities: AiCapabilities;
  complete: (messages: AiChatMessage[], options?: AiCompletionOptions) => Promise<AiCompletion>;
}

const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_MAX_IMAGES = 6;

/** True when an API key is present; absent configuration disables AI features. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_API_KEY || process.env.OPENROUTER_API_KEY);
}

export interface ProviderConfig {
  id: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  timeoutMs: number;
}

/**
 * Reads one provider's configuration.
 *
 * `AI_PROVIDER` names the provider; it is recorded for observability and
 * capability lookup, but the transport is the same for anything
 * OpenAI-compatible, so an unknown value still works if the base URL is right.
 */
export function readProviderConfig(): ProviderConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.AI_API_KEY;
  if (!apiKey) return null;

  const timeout = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);

  return {
    id: (process.env.AI_PROVIDER || 'openrouter').toLowerCase(),
    model: process.env.AI_MODEL || 'google/gemini-pro-vision',
    baseUrl: (process.env.AI_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
    apiKey,
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS,
  };
}

function readFallbackConfigs(): ProviderConfig[] {
  const fallbacks: ProviderConfig[] = [];

  for (const index of [1, 2]) {
    const provider = process.env[`AI_FALLBACK_${index}_PROVIDER`];
    const model = process.env[`AI_FALLBACK_${index}_MODEL`];
    if (!provider || !model) continue;

    const baseUrl = process.env[`AI_FALLBACK_${index}_BASE_URL`];
    const apiKey =
      process.env[`AI_FALLBACK_${index}_API_KEY`] ??
      process.env.OPENROUTER_API_KEY ??
      process.env.AI_API_KEY;
    if (!baseUrl || !apiKey) continue;

    fallbacks.push({
      id: provider.toLowerCase(),
      model,
      baseUrl: baseUrl.replace(/\/+$/, ''),
      apiKey,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });
  }

  return fallbacks;
}

/** Builds an OpenAI-compatible provider from configuration. */
export function createOpenAiCompatibleProvider(config: ProviderConfig): AiProvider {
  return {
    id: config.id,
    model: config.model,
    capabilities: {
      supportsVision: true,
      supportsStructuredOutput: true,
      maxImages: DEFAULT_MAX_IMAGES,
    },
    async complete(messages, options = {}) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        options.timeoutMs ?? config.timeoutMs,
      );

      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
            'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
            'X-Title': 'Hydrascapes',
          },
          body: JSON.stringify({
            model: config.model,
            messages: messages.map(toWireMessage),
            max_tokens: options.maxTokens ?? 2000,
            temperature: options.temperature ?? 0.1,
            ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const detail = await response.text();
          throw new Error(
            `Provider ${config.id} returned ${response.status}: ${detail.slice(0, 300)}`,
          );
        }

        const payload = (await response.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };

        const content = payload.choices?.[0]?.message?.content;
        if (typeof content !== 'string' || content.trim().length === 0) {
          throw new Error(`Provider ${config.id} returned an empty completion`);
        }

        return {
          content,
          model: config.model,
          usage: payload.usage
            ? {
                promptTokens: payload.usage.prompt_tokens,
                completionTokens: payload.usage.completion_tokens,
              }
            : undefined,
        };
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Provider ${config.id} timed out after ${config.timeoutMs}ms`);
        }
        throw error;
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

function toWireMessage(message: AiChatMessage) {
  if (typeof message.content === 'string') {
    return { role: message.role, content: message.content };
  }

  return {
    role: message.role,
    content: message.content.map((part) =>
      part.type === 'text'
        ? { type: 'text', text: part.text }
        : { type: 'image_url', image_url: { url: part.url, detail: 'high' } },
    ),
  };
}

/**
 * Providers to try, primary first. Empty when nothing is configured — callers
 * must treat that as "AI disabled", not as an error to surface to users.
 */
export function getProviders(): AiProvider[] {
  const primary = readProviderConfig();
  const configs = primary ? [primary, ...readFallbackConfigs()] : readFallbackConfigs();
  return configs.map(createOpenAiCompatibleProvider);
}
