import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeRateLimit, enforceRateLimit, RATE_LIMITS } from '../app/lib/rate-limit';
import { HttpError } from '../app/lib/http-error';

/** Minimal stand-in for the RPC surface. */
function fakeClient(rpcResult: { data?: unknown; error?: unknown }): SupabaseClient {
  return {
    rpc: vi.fn().mockResolvedValue({ data: null, error: null, ...rpcResult }),
  } as unknown as SupabaseClient;
}

describe('consumeRateLimit', () => {
  it('reports the allowance from the RPC', async () => {
    const client = fakeClient({
      data: [
        {
          allowed: true,
          remaining: 4,
          reset_at: new Date(Date.now() + 60_000).toISOString(),
        },
      ],
    });

    const result = await consumeRateLimit(client, 'ai:vision:user-1', RATE_LIMITS.aiVision);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.enforced).toBe(true);
  });

  it('passes the policy through to the database', async () => {
    const client = fakeClient({ data: [{ allowed: true, remaining: 0, reset_at: null }] });

    await consumeRateLimit(client, 'upload:user-1', { windowSeconds: 60, max: 5 });

    expect(client.rpc).toHaveBeenCalledWith('consume_rate_limit', {
      p_key: 'upload:user-1',
      p_window_seconds: 60,
      p_max: 5,
    });
  });

  it('fails open when the function is missing, and says so', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = fakeClient({ error: { message: 'function does not exist' } });

    const result = await consumeRateLimit(client, 'ai:vision:user-1', RATE_LIMITS.aiVision);

    expect(result.allowed).toBe(true);
    expect(result.enforced).toBe(false);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('fails open on an unexpected payload shape', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = fakeClient({ data: [] });

    const result = await consumeRateLimit(client, 'ai:vision:user-1', RATE_LIMITS.aiVision);

    expect(result.allowed).toBe(true);
    expect(result.enforced).toBe(false);
    consoleError.mockRestore();
  });
});

describe('enforceRateLimit', () => {
  it('allows a request under the limit', async () => {
    const client = fakeClient({
      data: [{ allowed: true, remaining: 1, reset_at: new Date(Date.now() + 30_000).toISOString() }],
    });

    await expect(
      enforceRateLimit(client, 'ai:vision:user-1', RATE_LIMITS.aiVision),
    ).resolves.toMatchObject({ allowed: true });
  });

  it('throws 429 with a Retry-After header when exhausted', async () => {
    const client = fakeClient({
      data: [{ allowed: false, remaining: 0, reset_at: new Date(Date.now() + 90_000).toISOString() }],
    });

    await expect(
      enforceRateLimit(client, 'ai:vision:user-1', RATE_LIMITS.aiVision),
    ).rejects.toMatchObject({
      name: 'HttpError',
      status: 429,
    });

    try {
      await enforceRateLimit(client, 'ai:vision:user-1', RATE_LIMITS.aiVision);
    } catch (error) {
      expect(error).toBeInstanceOf(HttpError);
      const retryAfter = Number((error as HttpError).headers['Retry-After']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(90);
    }
  });
});

describe('RATE_LIMITS', () => {
  it('budgets vision far more tightly than generic writes', () => {
    expect(RATE_LIMITS.aiVision.max).toBeLessThan(RATE_LIMITS.upload.max);
    expect(RATE_LIMITS.aiVision.windowSeconds).toBe(3600);
  });
});
