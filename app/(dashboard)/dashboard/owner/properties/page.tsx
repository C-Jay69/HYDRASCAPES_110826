import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

export default async function OwnerPropertiesPage() {
  const { user, profile } = await getUser();
  if (!user || !profile) redirect('/login');

  const supabase = await createClient();
  const { data: properties } = await supabase
    .from('properties')
    .select('id, title, status, base_price_minor, cover_photo, created_at')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Manage your listed properties.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-divider bg-card p-6">
          <h2 className="text-lg font-semibold">Your properties</h2>
          {properties && properties.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {properties.map((property) => (
                <li
                  key={property.id}
                  className="flex items-center justify-between rounded-lg border border-divider bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{property.title}</p>
                    <p className="text-xs text-foreground-faint">{property.status}</p>
                  </div>
                  <p className="text-sm font-semibold text-teal-300">
                    {((property.base_price_minor ?? 0) / 100).toFixed(2)}/night
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-foreground-faint">
              No properties yet. List your first property to get started.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-divider bg-card p-6">
          <h2 className="text-lg font-semibold">Add property</h2>
          <p className="mt-2 text-sm text-foreground-muted">
            Click below to list a new property.
          </p>
          <div className="mt-4">
            <a
              href="/dashboard/owner/properties/new"
              className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90"
            >
              Add property
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}