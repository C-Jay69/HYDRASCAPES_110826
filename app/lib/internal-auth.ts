import { createHash, timingSafeEqual } from 'node:crypto';
import { HttpError } from '@/app/lib/http-error';

/**
 * Machine-to-machine authentication (spec §18, §21).
 *
 * Internal routes are not reachable by users; they are called by schedulers
 * and n8n. The token never appears in a cookie or query string.
 */
export function requireInternalToken(request: Request): void {
  const expected = process.env.INTERNAL_API_TOKEN;
  if (!expected) {
    throw new HttpError(503, 'Internal API is not configured');
  }

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!constantTimeEquals(provided, expected)) {
    throw new HttpError(401, 'Invalid internal token');
  }
}

/** Compares fixed-length digests so comparison time does not leak the token. */
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a).digest();
  const digestB = createHash('sha256').update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
