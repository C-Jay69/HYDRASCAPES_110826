import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

export default async function AdminDashboardPage() {
  const { user, profile } = await getUser();
  if (!user || !profile) redirect('/login');

  const role = profile.role ?? 'guest';
  if (role !== 'admin') redirect(`/dashboard/${role}`);

  const supabase = await createClient();
  const [{ count: users }, { count: properties }, { count: openDisputes }] =
    await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('properties').select('*', { count: 'exact', head: true }),
      supabase
        .from('disputes')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'under_review']),
    ]);

  const stats = [
    { label: 'Users', value: users ?? 0 },
    { label: 'Properties', value: properties ?? 0 },
    { label: 'Open disputes', value: openDisputes ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin overview</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Platform health at a glance.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-divider bg-card p-6">
            <p className="text-sm text-foreground-muted">{stat.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-teal-300">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}