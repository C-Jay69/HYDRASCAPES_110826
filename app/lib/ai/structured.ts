/**
 * The single structured-output boundary (spec §3, §8.2).
 *
 * `aiJson()` is the only place in the codebase allowed to `JSON.parse` model
 * output. It:
 *
 *   - calls the configured provider (primary, then configured fallbacks),
 *   - extracts JSON safely (fenced blocks and stray prose removed),
 *   - validates with a Zod schema,
 *   - retries a bounded number of times, feeding the validation error back,
 *   - records operational metadata (spec §8.3) without logging prompts/images,
 *   - throws rather than inventing a result when everything fails.
 *
 * It never fabricates data. A caller that wants a degraded experience decides
 * what "no analysis" means; this layer will not make that decision by making
 * something up.
 */

import { z } from 'zod';
import {
  getProviders,
  type AiChatMessage,
  type AiProvider,
} from '@/app/lib/ai/provider';

export class AiUnavailableError extends Error {
  constructor(message = 'No AI provider is configured') {
    super(message);
    this.name = 'AiUnavailableError';
  }
}

export class AiValidationError extends Error {
  readonly attempts: number;

  constructor(message: string, attempts: number) {
    super(message);
    this.name = 'AiValidationError';
    this.attempts = attempts;
  }
}

export interface AiJsonRequest<T> {
  /** Short task label for logs, e.g. `property_vision`. */
  task: string;
  prompt: string;
  schema: z.ZodType<T>;
  system?: string;
  /** Image URLs the provider should look at. */
  images?: string[];
  /** Attempts per provider, including the first. Clamped to 1..4. */
  maxAttempts?: number;
  /**
   * Last-chance normalization applied to parsed JSON before validation — for
   * harmless model quirks such as returning 11/10 or "9" for a score. It must
   * not invent fields; anything it cannot fix still fails validation.
   */
  coerce?: (value: unknown) => unknown;
}

export interface AiJsonResult<T> {
  data: T;
  provider: string;
  model: string;
  attempts: number;
  latencyMs: number;
}

const DEFAULT_SYSTEM =
  'You are an expert evaluator for Hydrascapes, a co-hosting marketplace. ' +
  'Return only a single valid JSON object that matches the requested shape. ' +
  'No prose, no markdown, no code fences.';

const DEFAULT_MAX_ATTEMPTS = 2;

export async function aiJson<T>(request: AiJsonRequest<T>): Promise<AiJsonResult<T>> {
  const providers = getProviders();
  if (providers.length === 0) {
    throw new AiUnavailableError();
  }

  const maxAttempts = Math.min(4, Math.max(1, request.maxAttempts ?? DEFAULT_MAX_ATTEMPTS));
  const startedAt = Date.now();
  let attempts = 0;
  let lastError = 'unknown error';

  for (const provider of providers) {
    const usableImages = request.images?.slice(0, provider.capabilities.maxImages) ?? [];

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      attempts += 1;
      const messages = buildMessages(request, usableImages, attempt > 1 ? lastError : null);

      try {
        const completion = await provider.complete(messages, {
          jsonMode: provider.capabilities.supportsStructuredOutput,
        });

        const parsed = parseJsonObject(completion.content);
        if (!parsed.ok) {
          lastError = parsed.reason;
          continue;
        }

        const candidate = request.coerce ? request.coerce(parsed.value) : parsed.value;
        const validated = request.schema.safeParse(candidate);
        if (!validated.success) {
          lastError = validated.error.issues
            .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
            .join('; ');
          continue;
        }

        logMetadata({
          task: request.task,
          provider: provider.id,
          model: completion.model,
          attempts,
          latencyMs: Date.now() - startedAt,
          ok: true,
          imageCount: usableImages.length,
        });

        return {
          data: validated.data,
          provider: provider.id,
          model: completion.model,
          attempts,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        // Transport and timeout failures are worth one retry, then the next
        // provider. They are not retried maxAttempts times on their own.
        lastError = error instanceof Error ? error.message : String(error);
        if (attempt >= 2) break;
      }
    }
  }

  logMetadata({
    task: request.task,
    provider: 'all',
    model: 'all',
    attempts,
    latencyMs: Date.now() - startedAt,
    ok: false,
    imageCount: request.images?.length ?? 0,
  });

  throw new AiValidationError(
    `AI output failed validation after ${attempts} attempt(s). Last error: ${lastError}`,
    attempts,
  );
}

interface ParsedJson {
  ok: true;
  value: unknown;
}

interface ParseFailure {
  ok: false;
  reason: string;
}

/**
 * Extracts a JSON object from a completion. Handles ```json fences and models
 * that prefix/suffix prose. Returns a failure reason instead of throwing so the
 * caller can feed it back to the model on retry.
 */
export function parseJsonObject(content: string): ParsedJson | ParseFailure {
  const withoutFences = content
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const candidate = withoutFences.startsWith('{')
    ? withoutFences
    : extractFirstObject(withoutFences);

  if (!candidate) {
    return { ok: false, reason: 'Response did not contain a JSON object' };
  }

  try {
    return { ok: true, value: JSON.parse(candidate) };
  } catch (error) {
    return {
      ok: false,
      reason: `Response was not valid JSON (${error instanceof Error ? error.message : 'parse error'})`,
    };
  }
}

/** Returns the outermost balanced `{...}` block, or null. */
function extractFirstObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }

    if (char === '"') inString = true;
    else if (char === '{') depth += 1;
    else if (char === '}') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }

  return null;
}

function buildMessages<T>(
  request: AiJsonRequest<T>,
  images: string[],
  feedback: string | null,
): AiChatMessage[] {
  const messages: AiChatMessage[] = [
    { role: 'system', content: request.system ?? DEFAULT_SYSTEM },
    {
      role: 'user',
      content: images.length
        ? [
            { type: 'text', text: request.prompt },
            ...images.map((url) => ({ type: 'image' as const, url })),
          ]
        : request.prompt,
    },
  ];

  if (feedback) {
    messages.push({
      role: 'user',
      content:
        `Your previous response was rejected: ${feedback}. ` +
        'Return a corrected JSON object only, matching the requested shape exactly.',
    });
  }

  return messages;
}

function logMetadata(meta: {
  task: string;
  provider: string;
  model: string;
  attempts: number;
  latencyMs: number;
  ok: boolean;
  imageCount: number;
}) {
  // Spec §8.3: metadata only. Never log prompts, images or personal data.
  console.info('[ai]', JSON.stringify(meta));
}

/** Convenience for adapters that only need the primary provider's identity. */
export function activeProvider(): AiProvider | null {
  return getProviders()[0] ?? null;
}
