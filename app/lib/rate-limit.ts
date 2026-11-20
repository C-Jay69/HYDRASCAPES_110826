/**
 * Rate limiting (spec §21).
 *
 * Counters live in Postgres (see `0011_rate_limits.sql`), not in process
 * memory, so limits hold across serverless instances. Keys always include the
 * authenticated user id — browser state is never trusted for this.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { HttpError } from '@/app/lib/http-error';

export interface RateLimitPolicy {
  /** Window length in seconds. */
  windowSeconds: number;
  /** Requests allowed per window. */
  max: number;
}

/**
 * Policies for the endpoints that cost money, disk or abuse surface.
 * Tuned for a single owner managing a handful of listings; raise deliberately.
 */
export const RATE_LIMITS = {
  /** Vision re-analysis: each run costs inference tokens. */
  aiVision: { windowSeconds: 3600, max: 20 },
  /** Uploads: 10 MB each, so this caps storage growth per hour. */
  upload: { windowSeconds: 3600, max: 100 },
  /** Property creation. */
  propertyCreate: { windowSeconds: 3600, max: 30 },
  /** Destructive or state-changing property operations. */
  propertyWrite: { windowSeconds: 3600, max: 120 },
} as const satisfies Record<string, RateLimitPolicy>;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  /** False when the limiter itself could not be consulted. */
  enforced: boolean;
}

/**
 * Consumes one unit of the named policy.
 *
 * Fails **open** if the RPC is unavailable: these endpoints already require an
 * authenticated owner acting on their own resource, and a broken limiter must
 * not take the whole app down. Every failure is logged loudly so the gap is
 * visible rather than silent.
 */
export async function consumeRateLimit(
  supabase: SupabaseClient,
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const { data, error } = await supabase.rpc('consume_rate_limit', {
    p_key: key,
    p_window_seconds: policy.windowSeconds,
    p_max: policy.max,
  });

  if (error) {
    console.error(
      `[rate-limit] RPC failed for "${key}" (${policy.max}/${policy.windowSeconds}s): ${error.message}. ` +
        'ALLOWING the request; apply migration 0011 to enforce limits.',
    );
    return {
      allowed: true,
      remaining: policy.max,
      resetAt: new Date(Date.now() + policy.windowSeconds * 1000),
      enforced: false,
    };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row.allowed !== 'boolean') {
    console.error(`[rate-limit] Unexpected RPC payload for "${key}"`);
    return {
      allowed: true,
      remaining: policy.max,
      resetAt: new Date(Date.now() + policy.windowSeconds * 1000),
      enforced: false,
    };
  }

  return {
    allowed: row.allowed,
    remaining: Number(row.remaining ?? 0),
    resetAt: row.reset_at ? new Date(row.reset_at) : new Date(),
    enforced: true,
  };
}

/** Applies a policy and throws a 429 with `Retry-After` when exhausted. */
export async function enforceRateLimit(
  supabase: SupabaseClient,
  key: string,
  policy: RateLimitPolicy,
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(supabase, key, policy);

  if (!result.allowed) {
    const retryAfter = Math.max(1, Math.ceil((result.resetAt.getTime() - Date.now()) / 1000));
    throw new HttpError(429, `Too many requests. Try again in ${retryAfter} seconds.`, {
      'Retry-After': String(retryAfter),
    });
  }

  return result;
}
