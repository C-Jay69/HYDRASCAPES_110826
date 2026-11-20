import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import type { Profile, UserRole } from '@/app/core/entities';

/**
 * Role gate for dashboard pages.
 *
 * Middleware only proves someone is signed in; it cannot know which dashboard
 * they are allowed to open. Without this, any authenticated user could read
 * another role's pages (spec §20 "server-enforced role authorization").
 */
export async function requireDashboardRole(
  roles: UserRole[],
): Promise<{ user: { id: string }; profile: Profile }> {
  const { user, profile } = await getUser();

  if (!user || !profile) redirect('/login');

  if (!roles.includes(profile.role)) {
    // Send them to the dashboard they do own rather than a dead end.
    redirect(`/dashboard/${profile.role}`);
  }

  return { user, profile };
}
