import { redirect } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createClient } from '@/app/lib/supabase/server';

export default async function GuestDashboardPage() {
  const { user, profile } = await getUser();
  if (!user || !profile) redirect('/login');

  const supabase = await createClient();
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, checkin, checkout, status, total_amount_minor, properties(title)')
    .eq('guest_id', user.id)
    .order('created_at', { ascending: false });

  type BookingWithProperty = {
    id: string;
    checkin: string;
    checkout: string;
    status: string;
    total_amount_minor: number;
    properties: { title: string }[] | null;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Guest overview</h1>
        <p className="mt-1 text-sm text-foreground-muted">
          {profile.full_name}, here are your upcoming trips.
        </p>
      </div>

      <section className="rounded-2xl border border-divider bg-card p-6">
        <h2 className="text-lg font-semibold">Your bookings</h2>
        {bookings && bookings.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {bookings.map((booking) => {
              const property = (booking as BookingWithProperty).properties?.[0];
              return (
                <li
                  key={booking.id}
                  className="flex items-center justify-between rounded-lg border border-divider bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{property?.title ?? 'Stay'}</p>
                    <p className="text-xs text-foreground-faint">
                      {booking.checkin} → {booking.checkout} · {booking.status}
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
            No bookings yet. Search for a place to stay.
          </p>
        )}
      </section>
    </div>
  );
}