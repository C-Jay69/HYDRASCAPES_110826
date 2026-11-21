import { withMcp, uuidParam } from '@/app/lib/mcp/handler';
import { toPropertyDto } from '@/app/lib/mcp/serialize';
import { HttpError } from '@/app/lib/http-error';
import type { Property } from '@/app/core/entities';

export const dynamic = 'force-dynamic';

const COLUMNS =
  'id, owner_id, assigned_host_id, title, description, address_json, latitude, longitude, ' +
  'bedrooms, bathrooms, max_guests, amenities, base_price_minor, min_price_minor, ' +
  'max_price_minor, currency, cleaning_fee_minor, status, photos, cover_photo, vision_analysis, ' +
  'vision_status, created_at, updated_at';

/** GET /api/mcp/properties/[id] — any status, including drafts (operator view). */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMcp(request, async ({ service }) => {
    const id = uuidParam((await params).id, 'Property');

    const { data, error } = await service.from('properties').select(COLUMNS).eq('id', id).maybeSingle();
    if (error) {
      console.error(`MCP property lookup failed for ${id}:`, error);
      throw new HttpError(500, 'Could not load property');
    }
    if (!data) throw new HttpError(404, 'Property not found');

    return { property: toPropertyDto(data as unknown as Property) };
  });
}
