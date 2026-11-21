import { withMcp, intParam, textParam } from '@/app/lib/mcp/handler';
import { toBookingDto } from '@/app/lib/mcp/serialize';
import { HttpError } from '@/app/lib/http-error';
import type { Booking, BookingState } from '@/app/core/entities';

export const dynamic = 'force-dynamic';

const VALID_STATES: BookingState[] = [
  'pending_payment',
  'reserved',
  'confirmed',
  'checked_in',
  'checked_out',
  'completed',
  'cancelled',
  'refunded',
];

/**
 * GET /api/mcp/bookings
 *
 * Filters: status (comma-separated), upcoming=true (checkout today or later),
 * limit (default 25, max 100). Newest first.
 */
export async function GET(request: Request) {
  return withMcp(request, async ({ url, service }) => {
    const statusParam = textParam(url, 'status', 200);
    const upcoming = textParam(url, 'upcoming', 5) === 'true';
    const limit = intParam(url, 'limit', { min: 1, max: 100, fallback: 25 }) ?? 25;

    const statuses = statusParam
      ? statusParam.split(',').map((value) => value.trim()).filter(Boolean)
      : [];

    for (const status of statuses) {
      if (!VALID_STATES.includes(status as BookingState)) {
        throw new HttpError(400, `Unknown booking status "${status}"`);
      }
    }

    let query = service
      .from('bookings')
      .select('*, properties(title)')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (statuses.length > 0) query = query.in('status', statuses);
    if (upcoming) query = query.gte('checkout', new Date().toISOString().slice(0, 10));

    const { data, error } = await query;
    if (error) {
      console.error('MCP booking list failed:', error);
      throw new HttpError(500, 'Could not load bookings');
    }

    const rows = (data ?? []) as unknown as (Booking & { properties?: { title?: string }[] })[];
    return {
      count: rows.length,
      bookings: rows.map((row) =>
        toBookingDto(row, row.properties?.[0]?.title ?? null),
      ),
    };
  });
}
