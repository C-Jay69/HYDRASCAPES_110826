import { NextResponse } from 'next/server';
import { requireUser } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { createServiceClient } from '@/app/lib/supabase/service';
import { SupabasePropertyGateway } from '@/infrastructure/db/property.gateway';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import { SupabasePayoutGateway } from '@/infrastructure/db/payout.gateway';
import { CreateBookingUseCase } from '@/app/core/usecases/create-booking.use';
import { ConfirmBookingUseCase } from '@/app/core/usecases/confirm-booking.use';
import { createStripeAdapter, stripeIsConfigured } from '@/infrastructure/payments/stripe.adapter';
import { createBookingSchema, formatIssues } from '@/app/lib/bookings/schema';
import { HOLD_MINUTES, checkoutExpiresAt } from '@/app/lib/bookings/holds';
import { bookingErrorResponse } from '@/app/lib/bookings/http';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bookings
 *
 * Creates an unpaid booking that holds the dates, then starts payment.
 *
 * - Stripe configured: returns a Checkout URL. The booking stays
 *   `pending_payment` until the webhook confirms it.
 * - Stripe not configured, development: the booking is confirmed immediately
 *   and the response says so. No money moves; this exists so the flow can be
 *   exercised locally, and it is impossible in production.
 * - Stripe not configured, production: the hold is released and the request
 *   is refused, rather than leaving dates blocked by a booking nobody paid.
 */
export async function POST(request: Request) {
  try {
    const { supabase, user, profile } = await requireUser();
    await enforceRateLimit(supabase, `booking:create:${user.id}`, RATE_LIMITS.bookingAttempt);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Request body must be JSON' }, { status: 400 });
    }

    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid booking request', issues: formatIssues(parsed.error) },
        { status: 400 },
      );
    }

    const { propertyId, checkin, checkout, guestsCount, notes, policyKey } = parsed.data;

    const service = createServiceClient();

    // Release abandoned checkouts before they can look like availability.
    // Best-effort: a missing function (older migration set) must not break booking.
    try {
      await service.rpc('expire_stale_pending_bookings', { p_minutes: HOLD_MINUTES });
    } catch (expireError) {
      console.warn('Could not expire stale pending bookings:', expireError);
    }

    const propertyGateway = new SupabasePropertyGateway(service);
    const bookingGateway = new SupabaseBookingGateway(service);
    const payoutGateway = new SupabasePayoutGateway(service);

    const property = await propertyGateway.getById(propertyId);
    if (!property) {
      return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    }

    const createUseCase = new CreateBookingUseCase(bookingGateway);
    const { booking, quote } = await createUseCase.execute({
      property,
      guestId: user.id,
      checkin,
      checkout,
      guestsCount,
      guestsNotes: notes,
      policyKey,
    });

    const confirmUseCase = new ConfirmBookingUseCase(bookingGateway, payoutGateway);

    if (stripeIsConfigured()) {
      const stripe = createStripeAdapter(service);
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

      const session = await stripe.createCheckoutSession({
        bookingId: booking.id,
        amountMinor: quote.totalMinor,
        currency: quote.currency,
        description: `${property.title} · ${quote.nights} night${quote.nights === 1 ? '' : 's'}`,
        guestEmail: user.email ?? profile.email,
        successUrl: `${appUrl}/bookings/${booking.id}?payment=success`,
        cancelUrl: `${appUrl}/book/${property.id}?payment=cancelled`,
        // The session must expire before the hold does (Stripe plan review #1).
        expiresAt: checkoutExpiresAt(),
        automaticTax: process.env.STRIPE_TAX_ENABLED !== 'false',
      });

      return NextResponse.json(
        {
          booking,
          quote,
          payment: { mode: 'stripe', checkoutUrl: session.url },
        },
        { status: 201 },
      );
    }

    if (process.env.NODE_ENV === 'production') {
      // Release the hold: never keep dates blocked by an unpaid booking.
      await bookingGateway.transition(booking.id, ['pending_payment'], 'cancelled', {
        cancelled_at: new Date().toISOString(),
        refund_amount_minor: 0,
      });
      return NextResponse.json(
        { error: 'Payments are not configured; booking was not created', code: 'payments_unavailable' },
        { status: 503 },
      );
    }

    const confirmed = await confirmUseCase.execute({ bookingId: booking.id });

    return NextResponse.json(
      {
        booking: confirmed.booking,
        quote,
        payment: {
          mode: 'development',
          message:
            'Stripe is not configured, so this booking was confirmed without payment. ' +
            'Development only — no money moved.',
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
