import { withMcp, uuidParam } from '@/app/lib/mcp/handler';
import { toBookingDto } from '@/app/lib/mcp/serialize';
import { HttpError } from '@/app/lib/http-error';
import type { Booking } from '@/app/core/entities';

export const dynamic = 'force-dynamic';

/** GET /api/mcp/bookings/[id] — booking plus its payout, for one trip. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMcp(request, async ({ service }) => {
    const id = uuidParam((await params).id, 'Booking');

    const { data, error } = await service
      .from('bookings')
      .select('*, properties(title)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`MCP booking lookup failed for ${id}:`, error);
      throw new HttpError(500, 'Could not load booking');
    }
    if (!data) throw new HttpError(404, 'Booking not found');

    const row = data as unknown as Booking & { properties?: { title?: string }[] };

    const { data: payout } = await service
      .from('payouts')
      .select('id, status, owner_amount_minor, host_amount_minor, platform_amount_minor, currency, releasable_at, released_at')
      .eq('booking_id', id)
      .maybeSingle();

    return {
      booking: toBookingDto(row, row.properties?.[0]?.title ?? null),
      payout: payout
        ? {
            id: payout.id,
            status: payout.status,
            amounts: {
              ownerMinor: Number(payout.owner_amount_minor),
              hostMinor: Number(payout.host_amount_minor),
              platformMinor: Number(payout.platform_amount_minor),
              currency: payout.currency,
            },
            releasableAt: payout.releasable_at,
            releasedAt: payout.released_at,
          }
        : null,
    };
  });
}
