/**
 * Server-side authorization helpers (spec §20, §32).
 *
 * Every route handler that touches another user's data must go through here.
 * RLS is the last line of defence, not the first: an API route that trusts a
 * row it fetched with the service role must still check who is asking.
 */

import { createClient } from '@/app/lib/supabase/server';
import type { Profile, UserRole } from '@/app/core/entities';
import { HttpError } from '@/app/lib/http-error';

export { HttpError, errorResponse } from '@/app/lib/http-error';

export interface AuthContext {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: { id: string; email?: string | null };
  profile: Profile;
}

/** Cookie-bound client + verified user + profile. Throws 401 when absent. */
export async function requireUser(): Promise<AuthContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new HttpError(401, 'Not authenticated');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error || !profile) throw new HttpError(403, 'Profile not found for this account');

  return { supabase, user, profile: profile as Profile };
}

export async function requireRole(roles: UserRole[]): Promise<AuthContext> {
  const context = await requireUser();
  if (!roles.includes(context.profile.role)) {
    throw new HttpError(403, 'You do not have permission to perform this action');
  }
  return context;
}
