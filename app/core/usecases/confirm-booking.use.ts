import type { BookingGateway } from '@/infrastructure/db/booking.gateway';
import type { PayoutGateway } from '@/infrastructure/db/payout.gateway';
import type { Booking } from '@/app/core/entities';
import { assertTransition } from '@/app/lib/bookings/state';
import { computeSettlement } from '@/app/lib/bookings/settlement';
import { BookingNotFoundError } from '@/app/lib/bookings/errors';

export interface ConfirmBookingInput {
  bookingId: string;
  paymentIntentId?: string | null;
}

export interface ConfirmBookingOutput {
  booking: Booking;
  /** False when the booking was already confirmed — safe to call twice. */
  changed: boolean;
}

const PAYOUT_DELAY_HOURS = 24;
const HOUR_MS = 3_600_000;

/**
 * Confirms a paid booking and creates its payout record.
 *
 * Idempotent: a duplicate webhook re-running this returns `changed: false`
 * rather than creating a second payout or re-confirming.
 */
export class ConfirmBookingUseCase {
  constructor(
    private readonly bookings: BookingGateway,
    private readonly payouts: PayoutGateway,
  ) {}

  async execute(input: ConfirmBookingInput): Promise<ConfirmBookingOutput> {
    const booking = await this.bookings.getById(input.bookingId);
    if (!booking) throw new BookingNotFoundError();

    if (booking.status === 'confirmed' || booking.status === 'checked_in') {
      return { booking, changed: false };
    }

    assertTransition(booking.status, 'confirmed');

    const confirmed = await this.bookings.transition(
      booking.id,
      ['pending_payment', 'reserved'],
      'confirmed',
      input.paymentIntentId ? { stripe_payment_intent_id: input.paymentIntentId } : {},
    );

    // Another writer won the race: re-read and treat as already handled.
    if (!confirmed) {
      const current = await this.bookings.getById(booking.id);
      if (current && (current.status === 'confirmed' || current.status === 'checked_in')) {
        return { booking: current, changed: false };
      }
      throw new Error(`Booking ${booking.id} could not be confirmed from ${booking.status}`);
    }

    await this.ensurePayout(confirmed);

    return { booking: confirmed, changed: true };
  }

  private async ensurePayout(booking: Booking): Promise<void> {
    const existing = await this.payouts.getByBookingId(booking.id);
    if (existing) return;

    const split = await this.bookings.revenueSplit();
    const settlement = computeSettlement({
      totalMinor: Number(booking.total_amount_minor),
      split,
      hasHost: Boolean(booking.host_id),
    });

    // Payouts become releasable after checkout + the configured delay.
    const checkoutAt = new Date(`${booking.checkout}T00:00:00.000Z`).getTime();
    const releasableAt = new Date(checkoutAt + PAYOUT_DELAY_HOURS * HOUR_MS).toISOString();

    try {
      await this.payouts.create({
        booking_id: booking.id,
        owner_id: booking.owner_id,
        host_id: booking.host_id,
        settlement_base_minor: Number(booking.total_amount_minor),
        owner_amount_minor: settlement.ownerAmountMinor,
        host_amount_minor: settlement.hostAmountMinor,
        platform_amount_minor: settlement.platformAmountMinor,
        owner_pct_snapshot: settlement.ownerPct,
        host_pct_snapshot: settlement.hostPct,
        platform_pct_snapshot: settlement.platformPct,
        currency: booking.currency,
        status: 'held',
        releasable_at: releasableAt,
        stripe_transfer_owner_id: null,
        stripe_transfer_host_id: null,
      });
    } catch (error) {
      // A concurrent confirmation may have inserted the unique booking_id
      // first; that is the desired state, not a failure.
      const code = (error as { code?: string }).code;
      if (code !== '23505') throw error;
    }
  }
}
