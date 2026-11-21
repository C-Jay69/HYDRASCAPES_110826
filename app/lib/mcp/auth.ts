/**
 * MCP access key (see `mcp-server/`).
 *
 * The MCP server is an internal operator surface, not a user session, so it
 * authenticates with a single bearer token compared in constant time. The key
 * grants read access to marketplace data; write access is deliberately not
 * exposed.
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/app/lib/http-error';

export function requireMcpKey(request: Request): void {
  const expected = process.env.MCP_API_KEY;
  if (!expected) {
    throw new HttpError(503, 'MCP access is not configured (MCP_API_KEY unset)');
  }

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';

  if (!constantTimeEquals(provided, expected)) {
    throw new HttpError(401, 'Invalid MCP API key');
  }
}

/**
 * Stable, non-reversible identifier for the presented key, used only as a rate
 * limit bucket. Never log the key itself.
 */
export function mcpKeyId(request: Request): string {
  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return createHash('sha256').update(provided).digest('hex').slice(0, 12);
}

function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
