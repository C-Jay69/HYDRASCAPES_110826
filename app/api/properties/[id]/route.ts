import { NextResponse, after } from 'next/server';
import { createClient } from '@/app/lib/supabase/server';
import { requireUser, errorResponse, HttpError } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { updatePropertyInputSchema } from '@/app/lib/ai/schemas';
import { SupabasePropertyGateway } from '@/infrastructure/db/property.gateway';
import { AnalyzePropertyUseCase } from '@/app/core/usecases/analyze-property.use';
import { createAiAdapter } from '@/infrastructure/ai/openrouter.adapter';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';
import type { Property } from '@/app/core/entities';

/** Postgres foreign-key violation: a booking still references this property. */
const FK_VIOLATION = '23503';

async function loadForRequest(id: string) {
  const { supabase, user, profile } = await requireUser();
  const gateway = new SupabasePropertyGateway(supabase);
  const property = await gateway.getById(id);

  if (!property) throw new HttpError(404, 'Property not found');

  const isOwner = property.owner_id === user.id;
  const isAdmin = profile.role === 'admin';

  return { supabase, user, profile, gateway, property, isOwner, isAdmin };
}

/**
 * GET /api/properties/[id] — public for listed properties.
 *
 * Uses the cookie-bound client so RLS decides visibility: an anonymous caller
 * sees listed rows only, while an owner also sees their own drafts.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const gateway = new SupabasePropertyGateway(supabase);
    const property = await gateway.getById(id);

    if (!property) throw new HttpError(404, 'Property not found');

    return NextResponse.json({ property });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/properties/[id] — owner or admin.
 *
 * Photos changing re-queues vision analysis in the background; the save itself
 * is never blocked by the model (spec §1).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, gateway, property, isOwner, isAdmin } = await loadForRequest(id);

    if (!isOwner && !isAdmin) {
      throw new HttpError(403, 'You do not have permission to edit this property');
    }

    await enforceRateLimit(supabase, `property:write:${user.id}`, RATE_LIMITS.propertyWrite);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'Request body must be JSON');
    }

    const parsed = updatePropertyInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid property data',
          issues: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.') || '<root>',
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const updates = parsed.data;
    if (Object.keys(updates).length === 0) {
      throw new HttpError(400, 'No fields to update');
    }

    // The API speaks camelCase; the table is snake_case. Translate explicitly
    // rather than trusting key names to line up.
    const columnUpdates: Partial<Property> = {
      ...(updates.title !== undefined ? { title: updates.title } : {}),
      ...(updates.description !== undefined ? { description: updates.description } : {}),
      ...(updates.addressJson !== undefined ? { address_json: updates.addressJson } : {}),
      ...(updates.latitude !== undefined ? { latitude: updates.latitude } : {}),
      ...(updates.longitude !== undefined ? { longitude: updates.longitude } : {}),
      ...(updates.bedrooms !== undefined ? { bedrooms: updates.bedrooms } : {}),
      ...(updates.bathrooms !== undefined ? { bathrooms: updates.bathrooms } : {}),
      ...(updates.maxGuests !== undefined ? { max_guests: updates.maxGuests } : {}),
      ...(updates.amenities !== undefined ? { amenities: updates.amenities } : {}),
      ...(updates.basePriceMinor !== undefined
        ? { base_price_minor: updates.basePriceMinor }
        : {}),
      ...(updates.minPriceMinor !== undefined
        ? { min_price_minor: updates.minPriceMinor }
        : {}),
      ...(updates.maxPriceMinor !== undefined
        ? { max_price_minor: updates.maxPriceMinor }
        : {}),
      ...(updates.currency !== undefined ? { currency: updates.currency } : {}),
      ...(updates.cleaningFeeMinor !== undefined
        ? { cleaning_fee_minor: updates.cleaningFeeMinor }
        : {}),
      ...(updates.photos !== undefined ? { photos: updates.photos } : {}),
      ...(updates.coverPhoto !== undefined ? { cover_photo: updates.coverPhoto } : {}),
      ...(updates.status !== undefined ? { status: updates.status } : {}),
    };

    // The price band constraint spans three columns, so it must be checked
    // against the merged row, not just the patch.
    const merged = {
      min: updates.minPriceMinor ?? Number(property.min_price_minor),
      base: updates.basePriceMinor ?? Number(property.base_price_minor),
      max: updates.maxPriceMinor ?? Number(property.max_price_minor),
    };
    if (!(merged.min <= merged.base && merged.base <= merged.max)) {
      throw new HttpError(400, 'Price band must satisfy min <= base <= max');
    }

    const previousPhotoKey = photoKey(property);
    const updated = await gateway.update(id, columnUpdates);
    if (!updated) throw new HttpError(500, 'Update failed');

    const photosChanged = previousPhotoKey !== photoKey(updated);
    const aiPort = createAiAdapter();
    const shouldAnalyze = photosChanged && updated.photos.length > 0 && aiPort.isConfigured();

    if (shouldAnalyze) {
      after(async () => {
        try {
          const analyzeUseCase = new AnalyzePropertyUseCase(
            gateway,
            aiPort,
            createSignedUrlResolver(supabase),
          );
          await analyzeUseCase.execute({ propertyId: id });
        } catch (error) {
          console.error(`Background vision analysis failed for ${id}:`, error);
        }
      });
    }

    return NextResponse.json({ property: updated, vision: { queued: shouldAnalyze } });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/properties/[id] — owner or admin.
 *
 * Refuses (409) while a booking references the property: deleting the row
 * would destroy financial history, so the operator has to archive it instead.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, gateway, isOwner, isAdmin } = await loadForRequest(id);

    if (!isOwner && !isAdmin) {
      throw new HttpError(403, 'You do not have permission to delete this property');
    }

    await enforceRateLimit(supabase, `property:write:${user.id}`, RATE_LIMITS.propertyWrite);

    try {
      await gateway.delete(id);
    } catch (error) {
      if (isForeignKeyViolation(error)) {
        throw new HttpError(
          409,
          'This property has bookings and cannot be deleted. Unpublish it instead.',
        );
      }
      throw error;
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}

function photoKey(property: Property): string {
  return [...(property.photos ?? [])].sort().join('|') + `#${property.cover_photo ?? ''}`;
}

function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === FK_VIOLATION
  );
}
