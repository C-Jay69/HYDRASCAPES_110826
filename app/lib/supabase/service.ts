import { createClient } from '@supabase/supabase-js';

/**
 * Service-role client. Trusted backend use only (route handlers, edge
 * functions, server actions with explicit authorization checks).
 *
 * Never expose this client to the browser.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}