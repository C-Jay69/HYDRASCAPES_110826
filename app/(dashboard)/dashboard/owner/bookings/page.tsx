import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

export default async function OwnerBookingsPage() {
  const { user, profile } = await getUser();
  if (!user || !profile) redirect('/login');

  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, checkin, checkout, status, total_amount_minor, properties(title)')
    .eq('property_id', { owner_id: user.id })
    .order('created_at', { ascending: false });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bookings</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          Manage your property bookings.
        </p>
      </div>

      <section className="rounded-2xl border border-divider bg-card p-6">
        <h2 className="text-lg font-semibold">Your bookings</h2>
        {bookings && bookings.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {bookings.map((booking) => {
              const title = booking.properties?.[0]?.title ?? 'Property';
              return (
                <li
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border border-divider bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-foreground-faint">
                      {booking.checkin} → {booking.checkout}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-teal-300">
                    ${((booking.total_amount_minor ?? 0) / 100).toFixed(2)}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-foreground-faint">
            No bookings yet.
          </p>
        )}
      </section>
    </div>
  );
}