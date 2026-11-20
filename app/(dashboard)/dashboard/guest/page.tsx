import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';
import { requireDashboardRole } from '@/app/lib/dashboard-auth';
import { formatCurrency } from '@/app/lib/money';

const FEATURED_LIMIT = 6;

export default async function GuestDashboardPage() {
  const { user, profile } = await requireDashboardRole(['guest', 'admin']);

  const supabase = await createClient();

  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, checkin, checkout, status, total_amount_minor, currency, properties(title)')
    .eq('guest_id', user.id)
    .order('created_at', { ascending: false });

  // A guest with no bookings needs somewhere to go next, not an empty box.
  const { data: featured } = await supabase
    .from('properties')
    .select('id, title, address_json, base_price_minor, currency, cover_photo, bedrooms, max_guests')
    .eq('status', 'listed')
    .order('created_at', { ascending: false })
    .limit(FEATURED_LIMIT);

  // Covers are in a private bucket, so they are signed server-side.
  const resolver = createSignedUrlResolver(createServiceClient(), 600);
  const covers = await Promise.all(
    (featured ?? []).map((property) =>
      property.cover_photo
        ? resolver
            .signedUrls('property-photos', [property.cover_photo])
            .then((urls) => urls[0] ?? null)
        : Promise.resolve(null),
    ),
  );

  type BookingWithProperty = {
    id: string;
    checkin: string;
    checkout: string;
    status: string;
    total_amount_minor: number;
    currency: string | null;
    properties: { title: string }[] | null;
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Guest overview</h1>
          <p className="mt-1 text-sm text-foreground-muted">
            {profile.full_name}, here are your upcoming trips.
          </p>
        </div>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2 text-sm font-semibold text-void transition-opacity hover:opacity-90"
        >
          Browse stays
        </Link>
      </div>

      <section className="rounded-2xl border border-divider bg-card p-6">
        <h2 className="text-lg font-semibold">Your bookings</h2>
        {bookings && bookings.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {bookings.map((booking) => {
              const row = booking as BookingWithProperty;
              const property = row.properties?.[0];
              return (
                <li
                  key={row.id}
                  className="flex items-center justify-between rounded-lg border border-divider bg-surface px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{property?.title ?? 'Stay'}</p>
                    <p className="text-xs text-foreground-faint">
                      {row.checkin} → {row.checkout} · {row.status}
                    </p>
                  </div>
                  <p className="text-sm font-semibold text-teal-300">
                    {formatCurrency(row.total_amount_minor ?? 0, row.currency ?? 'USD')}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-foreground-faint">
              No bookings yet. Booking opens in a later phase — for now you can browse what
              owners have listed.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-divider px-4 py-2 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              Find a place to stay
            </Link>
          </div>
        )}
      </section>

      {featured && featured.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Places you can stay</h2>
            <Link href="/search" className="text-sm text-teal-300 hover:underline">
              See all stays →
            </Link>
          </div>

          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((property, index) => {
              const city =
                typeof property.address_json?.city === 'string'
                  ? property.address_json.city
                  : null;
              return (
                <li key={property.id}>
                  <Link
                    href={`/property/${property.id}`}
                    className="group block overflow-hidden rounded-2xl border border-divider bg-card transition-colors hover:border-teal-500/40"
                  >
                    {covers[index] ? (
                      /* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */
                      <img
                        src={covers[index] as string}
                        alt=""
                        className="h-36 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-36 w-full items-center justify-center bg-surface text-xs text-foreground-faint">
                        No photo yet
                      </div>
                    )}
                    <div className="space-y-1 p-4">
                      <h3 className="line-clamp-1 text-sm font-semibold">{property.title}</h3>
                      <p className="text-xs text-foreground-faint">
                        {city ? `${city} · ` : ''}
                        {property.bedrooms} bed · {property.max_guests} guests
                      </p>
                      <p className="pt-1 text-sm font-semibold text-teal-300">
                        {formatCurrency(Number(property.base_price_minor), property.currency)}
                        <span className="ml-1 text-xs font-normal text-foreground-muted">
                          /night
                        </span>
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
