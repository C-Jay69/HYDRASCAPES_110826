import { withMcp } from '@/app/lib/mcp/handler';
import { HttpError } from '@/app/lib/http-error';
import { quoteSchema, formatIssues } from '@/app/lib/bookings/schema';
import { buildQuote } from '@/app/lib/bookings/quote';
import { getCancellationPolicy, snapshotPolicy } from '@/app/lib/bookings/policies';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import type { Property } from '@/app/core/entities';

export const dynamic = 'force-dynamic';

/**
 * POST /api/mcp/quote — { propertyId, checkin, checkout, guestsCount }
 *
 * Prices a stay and reports availability without creating anything. Same
 * arithmetic the booking endpoint uses; this is the read-only preview.
 */
export async function POST(request: Request) {
  return withMcp(request, async ({ request: incoming, service }) => {
    const body = await incoming.json().catch(() => undefined);
    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, `Invalid quote request: ${formatIssues(parsed.error).map((i) => `${i.field} ${i.message}`).join('; ')}`);
    }

    const { propertyId, checkin, checkout, guestsCount } = parsed.data;

    const { data } = await service
      .from('properties')
      .select('id, title, status, base_price_minor, cleaning_fee_minor, currency, max_guests, min_price_minor, max_price_minor')
      .eq('id', propertyId)
      .maybeSingle();

    if (!data) throw new HttpError(404, 'Property not found');
    if (data.status !== 'listed') throw new HttpError(409, 'This property is not accepting bookings');

    const property = data as unknown as Property;
    const quote = buildQuote({
      basePriceMinor: Number(property.base_price_minor),
      cleaningFeeMinor: Number(property.cleaning_fee_minor),
      currency: property.currency,
      checkin,
      checkout,
      guestsCount,
      maxGuests: property.max_guests,
    });

    const gateway = new SupabaseBookingGateway(service);
    const [conflicts, blocks] = await Promise.all([
      gateway.findConflicts(propertyId, checkin, checkout),
      gateway.blockedWindows(propertyId, checkin, checkout),
    ]);

    const policy = getCancellationPolicy('moderate');

    return {
      property: { id: property.id, title: property.title, currency: property.currency },
      quote,
      available: conflicts.length === 0 && blocks.length === 0,
      unavailableReason:
        conflicts.length > 0
          ? 'Those dates are already booked'
          : blocks.length > 0
            ? 'The owner has blocked those dates'
            : null,
      cancellationPolicy: snapshotPolicy(policy),
    };
  });
}
