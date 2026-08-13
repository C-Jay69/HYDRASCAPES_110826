import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL ?? 'http://127.0.0.1:54321';
export const ANON_KEY =
  process.env.SUPABASE_ANON_KEY ?? 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';
export const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? 'sb_secret_N7UND0UgjKTVK-Uodkm0Hg_xSvEMPvz';

export const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'password';

export const IDS = {
  alice: '00000000-0000-0000-0000-000000000001',
  bob: '00000000-0000-0000-0000-000000000002',
  hannah: '00000000-0000-0000-0000-000000000003',
  george: '00000000-0000-0000-0000-000000000004',
  grace: '00000000-0000-0000-0000-000000000005',
  adam: '00000000-0000-0000-0000-000000000006',
  sarah: '00000000-0000-0000-0000-000000000007',
  elena: '00000000-0000-0000-0000-000000000008',
  grandBay: '10000000-0000-0000-0000-000000000001',
  soho: '10000000-0000-0000-0000-000000000002',
  aliceCottage: '10000000-0000-0000-0000-000000000003',
  booking1: '20000000-0000-0000-0000-000000000001',
} as const;

export const EMAILS: Record<keyof typeof IDS, string> = {
  alice: 'alice@nest.test',
  bob: 'bob@nest.test',
  hannah: 'hannah@nest.test',
  george: 'george@nest.test',
  grace: 'grace@nest.test',
  adam: 'adam@nest.test',
  sarah: 'sarah@nest.test',
  elena: 'elena@nest.test',
  grandBay: '',
  soho: '',
  aliceCottage: '',
  booking1: '',
};

const sessions = new Map<string, SupabaseClient>();

export async function asUser(key: keyof typeof IDS): Promise<SupabaseClient> {
  const cached = sessions.get(key);
  if (cached) return cached;
  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: EMAILS[key],
    password: SEED_PASSWORD,
  });
  if (error) throw new Error(`sign in as ${key}: ${error.message}`);
  sessions.set(key, client);
  return client;
}

export function anonClient(): SupabaseClient {
  return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
}

export function serviceClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
}