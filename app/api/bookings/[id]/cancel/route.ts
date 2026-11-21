import { NextResponse } from 'next/server';
import { requireUser } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { createServiceClient } from '@/app/lib/supabase/service';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import { SupabasePayoutGateway } from '@/infrastructure/db/payout.gateway';
import { CancelBookingUseCase } from '@/app/core/usecases/cancel-booking.use';
import { createStripeAdapter, stripeIsConfigured } from '@/infrastructure/payments/stripe.adapter';
import { bookingErrorResponse } from '@/app/lib/bookings/http';

/**
 * POST /api/bookings/[id]/cancel
 *
 * Cancels as a guest, owner, host or admin. The refund is computed from the
 * booking's policy snapshot; Stripe is only asked to move an amount this code
 * has already decided on.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, profile } = await requireUser();
    await enforceRateLimit(supabase, `booking:cancel:${user.id}`, RATE_LIMITS.bookingAttempt);

    // Cancellation is a state change, so it uses the service role after an
    // explicit authorization check inside the use case.
    const service = createServiceClient();
    const bookingGateway = new SupabaseBookingGateway(service);
    const payoutGateway = new SupabasePayoutGateway(service);

    const stripe = stripeIsConfigured() ? createStripeAdapter(service) : null;

    const useCase = new CancelBookingUseCase(bookingGateway, payoutGateway, stripe, stripe);
    const result = await useCase.execute({
      bookingId: id,
      actorId: user.id,
      actorRole: profile.role,
    });

    return NextResponse.json({
      booking: result.booking,
      refund: {
        amountMinor: result.refundMinor,
        tier: result.tier,
        reason: result.reason,
        sentToProvider: result.refundSent,
      },
      changed: result.changed,
    });
  } catch (error) {
    return bookingErrorResponse(error);
  }
}
