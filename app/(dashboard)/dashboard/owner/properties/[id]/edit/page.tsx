import { notFound } from 'next/navigation';
import { requireDashboardRole } from '@/app/lib/dashboard-auth';
import { createClient } from '@/app/lib/supabase/server';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';
import PropertyForm from '@/app/components/properties/property-form';
import AvailabilityEditor from '@/app/components/properties/availability-editor';
import type { Property } from '@/app/core/entities';

export const metadata = { title: 'Edit property' };

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { user, profile } = await requireDashboardRole(['owner', 'admin']);

  const supabase = await createClient();
  const { data } = await supabase.from('properties').select('*').eq('id', id).single();

  const property = data as Property | null;
  if (!property) notFound();

  // RLS already prevents reading another owner's property, but an admin is
  // allowed to open any of them and must not silently edit as the owner.
  const isOwner = property.owner_id === user.id;
  const isAdmin = profile.role === 'admin';
  if (!isOwner && !isAdmin) notFound();

  const paths = Array.from(
    new Set([property.cover_photo, ...(property.photos ?? [])].filter(Boolean) as string[]),
  );
  const previews = await createSignedUrlResolver(supabase, 600).signedUrls('property-photos', paths);
  const initialPhotos = paths.map((path, index) => ({ path, previewUrl: previews[index] ?? '' }));

  const address = (property.address_json ?? {}) as {
    line1?: string;
    city?: string;
    country?: string;
  };

  const { data: blockRows } = await supabase
    .from('availability_blocks')
    .select('start_date, end_date, reason')
    .eq('property_id', id)
    .order('start_date');

  const blocks = (blockRows ?? []).map((row) => ({
    start: row.start_date as string,
    end: row.end_date as string,
    reason: (row.reason as string | null) ?? null,
  }));

  return (
    <div className="mx-auto max-w-2xl space-y-6 py-12">
      <div className="rounded-2xl border border-divider bg-card p-8">
        <h1 className="mb-2 text-2xl font-semibold tracking-tight">Edit property</h1>
        <p className="mb-6 text-sm text-foreground-muted">
          Changing the photos re-runs vision analysis in the background. The save is never blocked
          by the model.
        </p>
        <PropertyForm
          property={{
            id: property.id,
            title: property.title,
            description: property.description,
            address,
            bedrooms: property.bedrooms,
            bathrooms: Number(property.bathrooms),
            maxGuests: property.max_guests,
            basePriceMinor: Number(property.base_price_minor),
            cleaningFeeMinor: Number(property.cleaning_fee_minor),
            currency: property.currency,
            status: property.status === 'listed' ? 'listed' : 'draft',
            coverPhoto: property.cover_photo,
          }}
          initialPhotos={initialPhotos.filter((photo) => photo.previewUrl)}
          canDelete={isOwner || isAdmin}
        />
      </div>

      <AvailabilityEditor propertyId={property.id} initialBlocks={blocks} />
    </div>
  );
}
