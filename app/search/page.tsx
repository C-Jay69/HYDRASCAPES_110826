import type { Metadata } from 'next';
import Link from 'next/link';
import { createClient } from '@/app/lib/supabase/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';
import { formatCurrency } from '@/app/lib/money';

export const metadata: Metadata = {
  title: 'Search stays',
  description: 'Find a place to stay on Hydrascapes.',
};

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 12;

interface SearchParams {
  q?: string;
  guests?: string;
  page?: string;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = (params.q ?? '').trim();
  const guests = Number.parseInt(params.guests ?? '', 10);
  const page = Math.max(1, Number.parseInt(params.page ?? '1', 10) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // RLS already restricts anonymous callers to listed properties; the explicit
  // status filter keeps the intent visible at the call site.
  const supabase = await createClient();
  let request = supabase
    .from('properties')
    .select(
      'id, title, description, address_json, base_price_minor, currency, bedrooms, bathrooms, max_guests, cover_photo, vision_status',
      { count: 'exact' },
    )
    .eq('status', 'listed')
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (Number.isFinite(guests) && guests > 0) {
    request = request.gte('max_guests', guests);
  }
  if (query) {
    request = request.or(`title.ilike.%${query}%,address_json->>city.ilike.%${query}%`);
  }

  const { data: properties, count } = await request;

  // Cover photos live in a private bucket, so they are signed server-side.
  const service = createServiceClient();
  const resolver = createSignedUrlResolver(service, 600);
  const covers = await Promise.all(
    (properties ?? []).map((property) =>
      property.cover_photo
        ? resolver.signedUrls('property-photos', [property.cover_photo]).then((urls) => urls[0] ?? null)
        : Promise.resolve(null),
    ),
  );

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-divider bg-void">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-medium text-foreground-muted hover:text-foreground">
            Hydrascapes
          </Link>
          <Link href="/dashboard" className="text-sm text-foreground-muted hover:text-foreground">
            Dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
        <h1 className="text-2xl font-semibold tracking-tight">Search stays</h1>

        <form method="get" className="flex flex-col gap-3 sm:flex-row">
          <label className="flex-1">
            <span className="sr-only">Destination or property name</span>
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="City or property name"
              className="w-full rounded-lg border border-divider bg-void px-4 py-2.5 text-sm placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-ember-500/20"
            />
          </label>
          <label className="sm:w-40">
            <span className="sr-only">Guests</span>
            <input
              type="number"
              name="guests"
              min={1}
              defaultValue={Number.isFinite(guests) ? guests : undefined}
              placeholder="Guests"
              className="w-full rounded-lg border border-divider bg-void px-4 py-2.5 text-sm placeholder:text-foreground-faint focus:outline-none focus:ring-2 focus:ring-ember-500/20"
            />
          </label>
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-5 py-2.5 text-sm font-semibold text-void"
          >
            Search
          </button>
        </form>

        <p className="text-sm text-foreground-faint">
          {count ?? 0} listed propert{(count ?? 0) === 1 ? 'y' : 'ies'}
          {query ? ` matching “${query}”` : ''}
        </p>

        {properties && properties.length > 0 ? (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {properties.map((property, index) => {
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
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center bg-surface text-xs text-foreground-faint">
                        No photo yet
                      </div>
                    )}
                    <div className="space-y-1 p-4">
                      <h2 className="line-clamp-1 text-sm font-semibold">{property.title}</h2>
                      <p className="text-xs text-foreground-faint">
                        {city ? `${city} · ` : ''}
                        {property.bedrooms} bed · {property.bathrooms} bath ·{' '}
                        {property.max_guests} guests
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
        ) : (
          <p className="rounded-2xl border border-divider bg-card p-8 text-sm text-foreground-muted">
            No listed properties match this search yet.
          </p>
        )}

        {totalPages > 1 && (
          <nav className="flex items-center justify-between text-sm" aria-label="Pagination">
            {page > 1 ? (
              <Link
                href={{ pathname: '/search', query: { ...params, page: page - 1 } }}
                className="text-teal-300 hover:underline"
              >
                ← Previous
              </Link>
            ) : (
              <span />
            )}
            <span className="text-foreground-faint">
              Page {page} of {totalPages}
            </span>
            {page < totalPages ? (
              <Link
                href={{ pathname: '/search', query: { ...params, page: page + 1 } }}
                className="text-teal-300 hover:underline"
              >
                Next →
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </main>
    </div>
  );
}
