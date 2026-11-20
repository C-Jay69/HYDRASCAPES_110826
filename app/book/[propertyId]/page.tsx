import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createServiceClient } from '@/app/lib/supabase/service';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';
import { formatCurrency } from '@/app/lib/money';
import { getCancellationPolicy } from '@/app/lib/bookings/policies';
import BookingForm from '@/app/components/bookings/booking-form';
import type { Property } from '@/app/core/entities';

export const metadata: Metadata = { title: 'Book a stay' };
export const dynamic = 'force-dynamic';

export default async function BookPropertyPage({
  params,
}: {
  params: Promise<{ propertyId: string }>;
}) {
  const { propertyId } = await params;
  const { user } = await getUser();

  const service = createServiceClient();
  const { data } = await service.from('properties').select('*').eq('id', propertyId).single();
  const property = data as Property | null;

  if (!property || property.status !== 'listed') notFound();

  const cover = property.cover_photo
    ? (
        await createSignedUrlResolver(service, 600).signedUrls('property-photos', [
          property.cover_photo,
        ])
      )[0]
    : null;

  const policy = getCancellationPolicy('moderate');

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-divider bg-void">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-medium text-foreground-muted hover:text-foreground">
            Hydrascapes
          </Link>
          <Link
            href={`/property/${property.id}`}
            className="text-sm text-foreground-muted hover:text-foreground"
          >
            Back to property
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-6 py-8 md:grid-cols-2">
        <section className="space-y-4">
          {cover && (
            /* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL */
            <img src={cover} alt="" className="h-64 w-full rounded-2xl object-cover" />
          )}
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{property.title}</h1>
            <p className="mt-1 text-sm text-foreground-muted">
              {typeof property.address_json?.city === 'string' ? property.address_json.city : ''}
              {property.bedrooms} bed · {property.bathrooms} bath · {property.max_guests} guests
            </p>
            <p className="mt-3 text-xl font-semibold text-teal-300">
              {formatCurrency(Number(property.base_price_minor), property.currency)}
              <span className="ml-1 text-sm font-normal text-foreground-muted">per night</span>
            </p>
          </div>

          <div className="rounded-2xl border border-divider bg-card p-4 text-sm text-foreground-muted">
            <h2 className="mb-1 font-semibold text-foreground">Cancellation policy</h2>
            <p>
              {policy.label}: full refund until {policy.fullRefundHours / 24} days before
              check-in
              {policy.partialRefundHours > 0
                ? `, then ${policy.partialRefundPct}% of the nightly subtotal until ${policy.partialRefundHours} hours before.`
                : '.'}
            </p>
            <p className="mt-2 text-xs text-foreground-faint">
              The policy and its version are recorded on the booking when you reserve, so later
              changes never rewrite your terms.
            </p>
          </div>
        </section>

        <section>
          {user ? (
            <BookingForm
              propertyId={property.id}
              maxGuests={property.max_guests}
              currency={property.currency}
            />
          ) : (
            <div className="rounded-2xl border border-divider bg-card p-6">
              <h2 className="text-lg font-semibold">Sign in to book</h2>
              <p className="mt-2 text-sm text-foreground-muted">
                You need an account to reserve dates. It takes a minute.
              </p>
              <Link
                href={`/login`}
                className="mt-4 inline-flex rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2 text-sm font-semibold text-void"
              >
                Sign in
              </Link>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
