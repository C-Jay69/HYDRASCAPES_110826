import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * Origins the browser is allowed to talk to.
 *
 * The browser talks to Supabase directly (auth, PostgREST, signed image
 * URLs), so its exact origin has to be in the policy — `https://*.supabase.co`
 * alone blocks a local stack at `http://127.0.0.1:54321`, which surfaces to the
 * user as "Failed to fetch" on sign-in and as missing images.
 */
function supabaseOrigins(): { http: string; ws: string } {
  const configured = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (configured) {
    try {
      const url = new URL(configured);
      return {
        http: url.origin,
        ws: `${url.protocol === 'https:' ? 'wss' : 'ws'}://${url.host}`,
      };
    } catch {
      console.warn(`Invalid NEXT_PUBLIC_SUPABASE_URL: ${configured}`);
    }
  }

  return { http: 'https://*.supabase.co', ws: 'wss://*.supabase.co' };
}

const supabase = supabaseOrigins();

/**
 * Content Security Policy (spec §20).
 *
 * `unsafe-inline` on script-src is required by Next's inline bootstrap in
 * this setup; a stricter nonce-based policy needs `middleware` nonce wiring
 * and is tracked as a follow-up. `unsafe-eval` is dev-only (HMR).
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  // Signed storage URLs are served from the Supabase origin as well.
  `img-src 'self' data: blob: ${supabase.http} https://*.supabase.co`,
  "font-src 'self' data:",
  // Auth, PostgREST, Storage and Realtime all go to the Supabase origin.
  `connect-src 'self' ${supabase.http} ${supabase.ws} https://*.supabase.co wss://*.supabase.co https://openrouter.ai`,
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self)',
  },
  ...(isDev
    ? []
    : [
        {
          key: 'Strict-Transport-Security',
          value: 'max-age=63072000; includeSubDomains; preload',
        },
      ]),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@supabase/supabase-js', 'sharp'],
  // The home directory contains another lockfile; pin the tracing root so the
  // build does not infer a workspace root above this project.
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
