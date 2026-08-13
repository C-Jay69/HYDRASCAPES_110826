import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

export default async function HostDashboardPage() {
  const { user, profile } = await getUser();
  if (!user || !profile) redirect('/login');

  const supabase = await createClient();
  const { data: applications } = await supabase
    .from('host_applications')
    .select('id, property_id, status, created_at, properties(title, status)')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false });

  type ApplicationWithProperty = {
    id: string;
    status: string;
    properties: { title: string; status: string }[] | null;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Host overview</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Track your applications and upcoming stays.
        </p>
      </div>

      <section className="rounded-2xl border border-divider bg-card p-6">
        <h2 className="text-lg font-semibold">Your applications</h2>
        {applications && applications.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {applications.map((application) => {
              const property = (application as ApplicationWithProperty).properties?.[0];
              return (
                <li
                  key={application.id}
                  className="flex items-center justify-between rounded-lg border border-divider bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{property?.title ?? 'Property'}</p>
                    <p className="text-xs text-foreground-faint">
                      {property?.status ?? 'unknown'} · {application.status}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-foreground-faint">
            No applications yet. Browse available properties to apply.
          </p>
        )}
      </section>
    </div>
  );
}