/**
 * HTTP error primitives shared by route handlers and helpers.
 *
 * Kept free of `next/headers` and Supabase imports so that modules which only
 * need to *raise* an error (rate limiting, pricing, storage) do not drag the
 * request context into unit tests.
 */

import { NextResponse } from 'next/server';

export class HttpError extends Error {
  readonly status: number;
  readonly headers: Record<string, string>;

  constructor(status: number, message: string, headers: Record<string, string> = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.headers = headers;
  }
}

/**
 * Turns thrown errors into JSON responses. Unknown errors are logged and
 * returned as a generic 500 so internals never leak to the client.
 */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: error.headers },
    );
  }
  console.error('Unhandled route error:', error);
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}
