import type { BookingGateway } from '@/infrastructure/db/booking.gateway';
import type { PayoutGateway } from '@/infrastructure/db/payout.gateway';
import type { Booking } from '@/app/core/entities';
import { assertTransition } from '@/app/lib/bookings/state';
import { computeSettlement } from '@/app/lib/bookings/settlement';
import { BookingNotFoundError } from '@/app/lib/bookings/errors';

export interface ConfirmBookingInput {
  bookingId: string;
  paymentIntentId?: string | null;
  /** Amount actually charged (tax inclusive), when the provider reports it. */
  paidTotalMinor?: number | null;
  /** Tax component of the charge, when the provider computed it. */
  taxMinor?: number | null;
  /** Charge id, kept for source_transaction and dispute matching. */
  chargeId?: string | null;
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

    // Automatic tax is computed by Stripe at checkout, so the charged amount can
    // exceed what we quoted. Persist the real amounts before paying anyone.
    const paidTotal = Math.trunc(input.paidTotalMinor ?? Number(booking.total_amount_minor));
    const tax = Math.trunc(input.taxMinor ?? Number(booking.taxes_minor ?? 0));
    if (Number.isSafeInteger(paidTotal) && paidTotal > Number(booking.total_amount_minor)) {
      const updated = await this.bookings.update(booking.id, {
        total_amount_minor: paidTotal,
        taxes_minor: Math.max(0, Math.min(tax, paidTotal)),
      });
      if (updated) {
        return this.finishConfirm(updated, input.paymentIntentId, input.chargeId ?? null);
      }
    }

    return this.finishConfirm(booking, input.paymentIntentId, input.chargeId ?? null);
  }

  private async finishConfirm(
    booking: Booking,
    paymentIntentId?: string | null,
    chargeId?: string | null,
  ): Promise<ConfirmBookingOutput> {
    const confirmed = await this.bookings.transition(
      booking.id,
      ['pending_payment', 'reserved'],
      'confirmed',
      {
        ...(paymentIntentId ? { stripe_payment_intent_id: paymentIntentId } : {}),
        ...(chargeId ? { stripe_charge_id: chargeId } : {}),
      },
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
    const feeConfig = await this.bookings.processingFees();
    const settlement = computeSettlement({
      totalMinor: Number(booking.total_amount_minor),
      taxMinor: Number(booking.taxes_minor ?? 0),
      split,
      hasHost: Boolean(booking.host_id),
      feeConfig,
    });

    // Payouts become releasable after checkout + the configured delay.
    const checkoutAt = new Date(`${booking.checkout}T00:00:00.000Z`).getTime();
    const releasableAt = new Date(checkoutAt + PAYOUT_DELAY_HOURS * HOUR_MS).toISOString();

    try {
      await this.payouts.create({
        booking_id: booking.id,
        owner_id: booking.owner_id,
        host_id: booking.host_id,
        settlement_base_minor: settlement.settlementBaseMinor,
        processing_fee_minor: settlement.processingFeeMinor,
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
