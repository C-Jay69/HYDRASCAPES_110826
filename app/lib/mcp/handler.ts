/**
 * Shared plumbing for the MCP read API.
 *
 * Every route: verify the key, rate limit by key id, run a fixed query with the
 * service role, return JSON. The queries are written here, never taken from the
 * request, so this surface cannot be turned into an arbitrary database client.
 */

import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/app/lib/supabase/service';
import { errorResponse, HttpError } from '@/app/lib/http-error';
import { enforceRateLimit } from '@/app/lib/rate-limit';
import { mcpKeyId, requireMcpKey } from '@/app/lib/mcp/auth';

const MCP_LIMIT = { windowSeconds: 60, max: 120 };

export interface McpContext {
  request: Request;
  url: URL;
  service: SupabaseClient;
}

export async function withMcp(
  request: Request,
  handler: (context: McpContext) => Promise<unknown>,
): Promise<NextResponse> {
  try {
    requireMcpKey(request);

    const service = createServiceClient();
    await enforceRateLimit(service, `mcp:${mcpKeyId(request)}`, MCP_LIMIT);

    const result = await handler({ request, url: new URL(request.url), service });
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

export function intParam(
  url: URL,
  name: string,
  bounds: { min: number; max: number; fallback?: number },
): number | null {
  const raw = url.searchParams.get(name);
  if (raw === null || raw.trim() === '') return bounds.fallback ?? null;

  const value = Number(raw);
  if (!Number.isInteger(value) || value < bounds.min || value > bounds.max) {
    throw new HttpError(
      400,
      `Query parameter "${name}" must be an integer between ${bounds.min} and ${bounds.max}`,
    );
  }
  return value;
}

export function textParam(url: URL, name: string, maxLength = 120): string | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return null;
  const value = raw.trim();
  if (value.length === 0) return null;
  if (value.length > maxLength) {
    throw new HttpError(400, `Query parameter "${name}" is too long`);
  }
  return value;
}

export function dateParam(url: URL, name: string): string | null {
  const value = textParam(url, name, 10);
  if (value === null) return null;

  // Round-trip through Date so impossible dates (2031-02-30) are rejected
  // rather than silently rolled forward.
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== value
  ) {
    throw new HttpError(400, `Query parameter "${name}" must be a date (YYYY-MM-DD)`);
  }
  return value;
}

/**
 * Validates a path id before it reaches Postgres. A malformed UUID would
 * otherwise surface as a 500 from the driver; to a caller it is simply "not
 * found".
 */
export function uuidParam(value: string, label = 'Resource'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new HttpError(404, `${label} not found`);
  }
  return value;
}

/** Escapes PostgREST filter metacharacters; wildcards are added by the caller. */
export function escapeFilterValue(value: string): string {
  return value.replace(/[%,()]/g, ' ').trim();
}
