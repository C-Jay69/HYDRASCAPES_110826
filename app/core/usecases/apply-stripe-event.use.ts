import type { BookingGateway } from '@/infrastructure/db/booking.gateway';
import type { ConfirmBookingUseCase } from '@/app/core/usecases/confirm-booking.use';
import type { RefundPort } from '@/app/core/usecases/cancel-booking.use';
import type { Booking } from '@/app/core/entities';

/**
 * Applies a verified Stripe event to booking state (spec §16).
 *
 * Only metadata written by *us* when creating the session is trusted to
 * identify a booking; the rest of the event payload is used for status and
 * amounts only. Webhook-level idempotency (processed_webhook_events) prevents
 * duplicates, and each handler is idempotent on its own as well.
 */

export interface StripeEventLike {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

export interface ApplyEventResult {
  outcome: 'handled' | 'ignored';
  detail: string;
}

export class ApplyStripeEventUseCase {
  constructor(
    private readonly bookings: BookingGateway,
    private readonly confirmBooking: ConfirmBookingUseCase,
    private readonly refunds: RefundPort | null = null,
  ) {}

  async execute(event: StripeEventLike): Promise<ApplyEventResult> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const object = event.data.object;
        const booking = await this.bookingFor(object);
        if (!booking) return ignored('checkout.session.completed without a known booking');
        return this.handlePaid({
          booking,
          paymentIntentId: paymentIntentIdOf(object),
          paidTotalMinor: numberField(object.amount_total),
          taxMinor: numberField(nested(object, 'total_details', 'amount_tax')),
        });
      }

      case 'payment_intent.succeeded': {
        const object = event.data.object;
        const booking =
          (await this.bookingFor(object)) ?? (await this.byIntentId(object.id));
        if (!booking) return ignored('payment_intent.succeeded for unknown booking');
        return this.handlePaid({
          booking,
          paymentIntentId: String(object.id),
          paidTotalMinor: numberField(object.amount_received) ?? numberField(object.amount),
          taxMinor: null,
        });
      }

      case 'checkout.session.expired': {
        // The session died before payment: release the dates instead of leaving
        // a hold that can never be paid.
        const booking = await this.bookingFor(event.data.object);
        if (!booking) return ignored('checkout.session.expired for unknown booking');
        if (booking.status !== 'pending_payment') {
          return ignored(`booking ${booking.id} is already ${booking.status}`);
        }
        const cancelled = await this.bookings.transition(booking.id, ['pending_payment'], 'cancelled', {
          cancelled_at: new Date().toISOString(),
          refund_amount_minor: 0,
        });
        return cancelled
          ? { outcome: 'handled', detail: `booking ${booking.id} released (session expired)` }
          : ignored(`booking ${booking.id} changed concurrently`);
      }

      case 'payment_intent.payment_failed': {
        const object = event.data.object;
        const booking = await this.bookingFor(object);
        if (!booking) return ignored('payment_intent.payment_failed for unknown booking');
        if (booking.status !== 'pending_payment' && booking.status !== 'reserved') {
          return ignored(`booking ${booking.id} is already ${booking.status}`);
        }
        // Payment failed: release the dates rather than hold them forever.
        const cancelled = await this.bookings.transition(
          booking.id,
          ['pending_payment', 'reserved'],
          'cancelled',
          { cancelled_at: new Date().toISOString(), refund_amount_minor: 0 },
        );
        return cancelled
          ? { outcome: 'handled', detail: `booking ${booking.id} cancelled (payment failed)` }
          : ignored(`booking ${booking.id} changed concurrently`);
      }

      case 'charge.refunded': {
        const object = event.data.object;
        const intentId = typeof object.payment_intent === 'string' ? object.payment_intent : null;
        const booking = intentId ? await this.byIntentId(intentId) : null;
        if (!booking) return ignored('charge.refunded for unknown booking');

        const refundedMinor = Number(object.amount_refunded ?? 0);
        if (refundedMinor < Number(booking.total_amount_minor)) {
          return {
            outcome: 'handled',
            detail: `partial refund of ${refundedMinor} recorded for ${booking.id}`,
          };
        }

        const updated = await this.bookings.transition(
          booking.id,
          ['cancelled', 'confirmed'],
          'refunded',
          { refund_amount_minor: refundedMinor },
        );
        return updated
          ? { outcome: 'handled', detail: `booking ${booking.id} marked refunded` }
          : ignored(`booking ${booking.id} is already ${booking.status}`);
      }

      // Money movement we record but do not act on yet (payments/transfers).
      case 'charge.succeeded':
      case 'transfer.created':
      case 'payout.paid':
      case 'account.updated':
        return { outcome: 'handled', detail: `${event.type} recorded` };

      default:
        return ignored(`unhandled event type ${event.type}`);
    }
  }

  private async confirm(bookingId: string, paymentIntentId: string | null) {
    const result = await this.confirmBooking.execute({ bookingId, paymentIntentId });
    return {
      outcome: 'handled' as const,
      detail: result.changed
        ? `booking ${bookingId} confirmed`
        : `booking ${bookingId} was already confirmed`,
    };
  }

  /**
   * Payment landed. If the booking is still live it is confirmed (with the
   * actual charged amount, which may include automatic tax). If it was already
   * cancelled — typically a session that expired after the hold — the guest is
   * refunded in full rather than left paying for nothing.
   */
  private async handlePaid(input: {
    booking: Booking;
    paymentIntentId: string | null;
    paidTotalMinor: number | null;
    taxMinor: number | null;
  }): Promise<ApplyEventResult> {
    const { booking, paymentIntentId, paidTotalMinor, taxMinor } = input;

    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      return this.refundLatePayment(booking, paymentIntentId, paidTotalMinor);
    }

    const result = await this.confirmBooking.execute({
      bookingId: booking.id,
      paymentIntentId,
      paidTotalMinor,
      taxMinor,
    });

    return {
      outcome: 'handled',
      detail: result.changed
        ? `booking ${booking.id} confirmed`
        : `booking ${booking.id} was already confirmed`,
    };
  }

  private async refundLatePayment(
    booking: Booking,
    paymentIntentId: string | null,
    paidTotalMinor: number | null,
  ): Promise<ApplyEventResult> {
    if (booking.status === 'refunded') {
      return ignored(`booking ${booking.id} was already refunded`);
    }

    const amount = Math.max(0, Math.trunc(paidTotalMinor ?? Number(booking.total_amount_minor)));

    if (!this.refunds || !paymentIntentId) {
      // Record the exposure so an operator can refund manually; do not pretend.
      await this.bookings.update(booking.id, { refund_amount_minor: amount });
      console.error(
        `Late payment on cancelled booking ${booking.id} needs a manual refund of ${amount}`,
      );
      return { outcome: 'handled', detail: `manual refund required for ${booking.id}` };
    }

    try {
      await this.refunds.refund(paymentIntentId, amount, `refund:late:${booking.id}`);
    } catch (error) {
      console.error(`Automatic late-payment refund failed for ${booking.id}:`, error);
      await this.bookings.update(booking.id, { refund_amount_minor: amount });
      return { outcome: 'handled', detail: `manual refund required for ${booking.id}` };
    }

    const updated = await this.bookings.transition(booking.id, ['cancelled'], 'refunded', {
      refund_amount_minor: amount,
    });

    return {
      outcome: 'handled',
      detail: updated
        ? `booking ${booking.id} was cancelled before payment; ${amount} refunded`
        : `booking ${booking.id} refunded, status not moved`,
    };
  }

  private async bookingFor(object: Record<string, unknown>): Promise<Booking | null> {
    const bookingId = metadataBookingId(object);
    return bookingId ? this.bookings.getById(bookingId) : null;
  }

  private byIntentId(intentId: unknown): Promise<Booking | null> {
    return typeof intentId === 'string'
      ? this.bookings.findByPaymentIntent(intentId)
      : Promise.resolve(null);
  }
}

function ignored(detail: string): ApplyEventResult {
  return { outcome: 'ignored', detail };
}

function metadataBookingId(object: Record<string, unknown>): string | null {
  const metadata = object.metadata;
  if (metadata && typeof metadata === 'object') {
    const id = (metadata as Record<string, unknown>).booking_id;
    if (typeof id === 'string' && id.length > 0) return id;
  }
  return null;
}

function numberField(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : null;
}

function nested(object: Record<string, unknown>, key: string, field: string): unknown {
  const inner = object[key];
  return inner && typeof inner === 'object' ? (inner as Record<string, unknown>)[field] : undefined;
}

function paymentIntentIdOf(object: Record<string, unknown>): string | null {
  const intent = object.payment_intent;
  if (typeof intent === 'string') return intent;
  if (intent && typeof intent === 'object') {
    const id = (intent as Record<string, unknown>).id;
    if (typeof id === 'string') return id;
  }
  return null;
}
