import { NextResponse } from 'next/server';
import { requireUser } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { createServiceClient } from '@/app/lib/supabase/service';
import { SupabasePropertyGateway } from '@/infrastructure/db/property.gateway';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import { buildQuote } from '@/app/lib/bookings/quote';
import { getCancellationPolicy, snapshotPolicy } from '@/app/lib/bookings/policies';
import { quoteSchema, formatIssues } from '@/app/lib/bookings/schema';
import { bookingErrorResponse } from '@/app/lib/bookings/http';

/**
 * POST /api/bookings/quote
 *
 * Prices a stay and reports availability without creating anything. The
 * database exclusion constraint remains the authority on availability; this
 * endpoint only tells the guest what they are about to book.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireUser();
    await enforceRateLimit(supabase, `booking:quote:${user.id}`, RATE_LIMITS.bookingAttempt);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
    }

    const parsed = quoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid quote request', issues: formatIssues(parsed.error) },
        { status: 400 },
      );
    }

    const { propertyId, checkin, checkout, guestsCount } = parsed.data;

    const service = createServiceClient();
    const propertyGateway = new SupabasePropertyGateway(service);
    const bookingGateway = new SupabaseBookingGateway(service);

    const property = await propertyGateway.getById(propertyId);
    if (!property || property.status !== 'listed') {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const quote = buildQuote({
      basePriceMinor: Number(property.base_price_minor),
      cleaningFeeMinor: Number(property.cleaning_fee_minor),
      currency: property.currency,
      checkin,
      checkout,
      guestsCount,
      maxGuests: property.max_guests,
    });

    const [conflicts, blocked] = await Promise.all([
      bookingGateway.findConflicts(propertyId, checkin, checkout),
      bookingGateway.blockedWindows(propertyId, checkin, checkout),
    ]);

    const policy = getCancellationPolicy('moderate');

    return NextResponse.json({
      property: {
        id: property.id,
        title: property.title,
        maxGuests: property.max_guests,
        currency: property.currency,
      },
      quote,
      available: conflicts.length === 0 && blocked.length === 0,
      unavailableReason:
        conflicts.length > 0
          ? 'Those dates are already booked'
          : blocked.length > 0
            ? 'The owner has blocked those dates'
            : null,
      cancellationPolicy: snapshotPolicy(policy),
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
