import { withMcp, dateParam, uuidParam } from '@/app/lib/mcp/handler';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import { HttpError } from '@/app/lib/http-error';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mcp/properties/[id]/availability?from=&to=
 *
 * Live bookings and owner blocks overlapping the window (defaults: today to one
 * year out). Read-only: nothing here reserves anything.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return withMcp(request, async ({ url, service }) => {
    const id = uuidParam((await params).id, 'Property');

    const today = new Date().toISOString().slice(0, 10);
    const from = dateParam(url, 'from') ?? today;
    const to = dateParam(url, 'to') ?? `${Number(today.slice(0, 4)) + 1}${today.slice(4)}`;

    if (to <= from) throw new HttpError(400, '"to" must be after "from"');

    const { data: property } = await service
      .from('properties')
      .select('id, title, status')
      .eq('id', id)
      .maybeSingle();

    if (!property) throw new HttpError(404, 'Property not found');

    const gateway = new SupabaseBookingGateway(service);
    const [bookings, blocks] = await Promise.all([
      gateway.findConflicts(id, from, to),
      gateway.blockedWindows(id, from, to),
    ]);

    return {
      propertyId: id,
      propertyTitle: property.title as string,
      window: { from, to },
      reserved: bookings.map((booking) => ({
        checkin: booking.checkin,
        checkout: booking.checkout,
        status: booking.status,
      })),
      blocked: blocks,
    };
  });
}
