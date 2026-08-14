import { createServiceClient } from '@/app/lib/supabase/service';
import type { UserRole } from '@/app/lib/types';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Role onboarding (SIGN UP).
 *
 * Role assignment is performed server-side via the service role so a client
 * cannot forge an admin role. The DB trigger (handle_new_user) is the final
 * authority and independently coerces any non-whitelisted role to "guest".
 */
const PERMITTED_ROLES: UserRole[] = ['owner', 'host', 'guest'];

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { email, password, full_name, role } = body;

  if (!email || !password || password.length < 8) {
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 400 });
  }

  if (!PERMITTED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Role not permitted at signup' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: full_name || '',
      role,
    },
  });

  if (error || !data.user) {
    return NextResponse.json({ error: error?.message ?? 'Signup failed' }, { status: 400 });
  }

  return NextResponse.json({ ok: true, user_id: data.user.id });
}
