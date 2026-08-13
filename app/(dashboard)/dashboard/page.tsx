import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';

export default async function DashboardPage() {
  const { user, profile } = await getUser();

  if (!user || !profile) redirect('/login');

  const role = profile.role ?? 'guest';
  redirect(`/dashboard/${role}`);
}