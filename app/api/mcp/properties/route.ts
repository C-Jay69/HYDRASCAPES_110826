import { withMcp, intParam, textParam, escapeFilterValue } from '@/app/lib/mcp/handler';
import { toPropertyDto } from '@/app/lib/mcp/serialize';
import { HttpError } from '@/app/lib/http-error';
import type { Property } from '@/app/core/entities';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp/properties
 *
 * Search listed properties. Filters: q (title), city, guests, minPrice and
 * maxPrice in minor units, limit (default 20, max 50).
 */
export async function GET(request: Request) {
  return withMcp(request, async ({ url, service }) => {
    const q = textParam(url, 'q');
    const city = textParam(url, 'city');
    const guests = intParam(url, 'guests', { min: 1, max: 100 });
    const minPrice = intParam(url, 'minPrice', { min: 0, max: 100_000_000 });
    const maxPrice = intParam(url, 'maxPrice', { min: 0, max: 100_000_000 });
    const limit = intParam(url, 'limit', { min: 1, max: 50, fallback: 20 }) ?? 20;

    let query = service
      .from('properties')
      .select(
        'id, owner_id, assigned_host_id, title, description, address_json, latitude, longitude, ' +
          'bedrooms, bathrooms, max_guests, amenities, base_price_minor, min_price_minor, ' +
          'max_price_minor, currency, cleaning_fee_minor, status, photos, cover_photo, ' +
          'vision_analysis, vision_status, created_at, updated_at',
      )
      .eq('status', 'listed')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (guests !== null) query = query.gte('max_guests', guests);
    if (minPrice !== null) query = query.gte('base_price_minor', minPrice);
    if (maxPrice !== null) query = query.lte('base_price_minor', maxPrice);
    if (city) query = query.ilike('address_json->>city', `%${escapeFilterValue(city)}%`);
    if (q) query = query.ilike('title', `%${escapeFilterValue(q)}%`);

    const { data, error } = await query;
    if (error) {
      console.error('MCP property search failed:', error);
      throw new HttpError(500, 'Could not search properties');
    }

    return {
      count: data?.length ?? 0,
      properties: ((data ?? []) as unknown as Property[]).map(toPropertyDto),
    };
  });
}
