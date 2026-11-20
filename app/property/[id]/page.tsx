import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getUser } from '@/app/lib/auth';
import { createServiceClient } from '@/app/lib/supabase/service';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';
import { formatCurrency } from '@/app/lib/money';
import PropertyEyeCard from '@/app/components/vision/property-eye-card';
import type { Property, VisionAnalysisResponse } from '@/app/core/entities';

export const dynamic = 'force-dynamic';

async function loadProperty(id: string) {
  const service = createServiceClient();
  const { data } = await service.from('properties').select('*').eq('id', id).single();
  return (data as Property | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const property = await loadProperty(id);
  if (!property) return { title: 'Property not found' };
  return { title: property.title, description: property.description ?? undefined };
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile } = await getUser();
  const property = await loadProperty(id);

  if (!property) notFound();

  const isOwner = user?.id === property.owner_id;
  const isAdmin = profile?.role === 'admin';

  // Drafts and managed properties are not public: anyone else gets a 404, not
  // a hint that the row exists.
  if (property.status !== 'listed' && !isOwner && !isAdmin) notFound();

  const photoPaths = Array.from(
    new Set([property.cover_photo, ...(property.photos ?? [])].filter(Boolean) as string[]),
  );

  // Private bucket: sign for display, shortest useful lifetime.
  const service = createServiceClient();
  const imageUrls = await createSignedUrlResolver(service, 600).signedUrls(
    'property-photos',
    photoPaths.slice(0, 12),
  );

  const vision = Object.keys(property.vision_analysis ?? {}).length
    ? (property.vision_analysis as unknown as Partial<VisionAnalysisResponse>)
    : null;

  const city = typeof property.address_json?.city === 'string' ? property.address_json.city : null;

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-divider bg-void">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-3">
          <Link href="/" className="text-sm font-medium text-foreground-muted hover:text-foreground">
            Hydrascapes
          </Link>
          <Link href="/search" className="text-sm text-foreground-muted hover:text-foreground">
            Search stays
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-8 px-6 py-8">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{property.title}</h1>
            {property.status !== 'listed' && (
              <span className="rounded-md border border-warning/30 bg-warning/10 px-2 py-0.5 text-[11px] font-semibold uppercase text-warning">
                {property.status}
              </span>
            )}
            {(isOwner || isAdmin) && (
              <Link
                href={`/dashboard/owner/properties/${property.id}/edit`}
                className="text-sm text-foreground-muted underline-offset-4 hover:text-foreground hover:underline"
              >
                Edit
              </Link>
            )}
          </div>
          <p className="mt-1 text-sm text-foreground-muted">
            {city ? `${city} · ` : ''}
            {property.bedrooms} bed · {property.bathrooms} bath · {property.max_guests} guests
          </p>
        </div>

        {imageUrls.length > 0 ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {imageUrls.map((url, index) => (
              <li key={url} className={index === 0 ? 'col-span-2 row-span-2 sm:col-span-2' : ''}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL, not a static asset */}
                <img
                  src={url}
                  alt={`${property.title} photo ${index + 1}`}
                  className="h-full max-h-80 w-full rounded-xl object-cover"
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-divider bg-card p-6 text-sm text-foreground-muted">
            No photos have been uploaded for this property yet.
          </p>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <section className="rounded-2xl border border-divider bg-card p-6">
              <h2 className="mb-2 text-lg font-semibold">About this stay</h2>
              <p className="whitespace-pre-line text-sm text-foreground-muted">
                {property.description || 'No description provided.'}
              </p>

              {property.amenities?.length > 0 && (
                <ul className="mt-4 flex flex-wrap gap-2">
                  {property.amenities.map((amenity) => (
                    <li
                      key={amenity}
                      className="rounded-md border border-divider px-2 py-1 text-xs text-foreground-muted"
                    >
                      {amenity}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <PropertyEyeCard
              propertyId={property.id}
              visionStatus={property.vision_status}
              analysis={vision}
              canReanalyze={isOwner || isAdmin}
            />
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-divider bg-card p-6">
              <p className="text-2xl font-semibold text-teal-300">
                {formatCurrency(Number(property.base_price_minor), property.currency)}
                <span className="ml-1 text-sm font-normal text-foreground-muted">per night</span>
              </p>
              {Number(property.cleaning_fee_minor) > 0 && (
                <p className="mt-1 text-sm text-foreground-muted">
                  + {formatCurrency(Number(property.cleaning_fee_minor), property.currency)} cleaning
                  fee
                </p>
              )}

              {property.status === 'listed' && (
                <Link
                  href={`/book/${property.id}`}
                  className="mt-4 block rounded-lg bg-gradient-to-r from-ember-500 to-teal-500 px-4 py-2.5 text-center text-sm font-semibold text-void transition-opacity hover:opacity-90"
                >
                  Check dates & book
                </Link>
              )}
            </div>

            <div className="rounded-2xl border border-divider bg-card p-6 text-sm text-foreground-muted">
              <h2 className="mb-2 text-sm font-semibold text-foreground">Price band</h2>
              <p>
                Nightly range:{' '}
                {formatCurrency(Number(property.min_price_minor), property.currency)} –{' '}
                {formatCurrency(Number(property.max_price_minor), property.currency)}
              </p>
              <p className="mt-2 text-xs text-foreground-faint">
                AI adjustments never exceed the owner&apos;s band or the configured cap.
              </p>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
