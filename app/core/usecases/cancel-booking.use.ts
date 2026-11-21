import type { BookingGateway } from '@/infrastructure/db/booking.gateway';
import type { PayoutGateway } from '@/infrastructure/db/payout.gateway';
import type { Booking, Payout, UserRole } from '@/app/core/entities';
import { calculateRefund, type RefundTier } from '@/app/lib/bookings/cancellation';
import { policyFromSnapshot } from '@/app/lib/bookings/policies';
import { canTransition, isLiveStatus } from '@/app/lib/bookings/state';
import { planReversals, reversalIdempotencyKey } from '@/app/lib/payments/release';
import {
  BookingNotFoundError,
  BookingPermissionError,
  BookingValidationError,
} from '@/app/lib/bookings/errors';

/** Anything that can send money back. Implemented by the Stripe adapter. */
export interface RefundPort {
  refund: (
    paymentIntentId: string,
    amountMinor: number,
    idempotencyKey: string,
  ) => Promise<{ id: string; status: string | null }>;
}

/** Claws money back from a payee when the payout already left the platform. */
export interface ReversalPort {
  reverseTransfer: (
    transferId: string,
    amountMinor: number,
    idempotencyKey: string,
  ) => Promise<{ id: string }>;
}

export interface CancelBookingInput {
  bookingId: string;
  actorId: string;
  actorRole: UserRole;
  now?: Date;
}

export interface CancelBookingOutput {
  booking: Booking;
  refundMinor: number;
  tier: RefundTier;
  reason: string;
  /** True when Stripe accepted a refund request in this call. */
  refundSent: boolean;
  changed: boolean;
}

/**
 * Cancels a booking and requests the refund its policy entitles the guest to.
 *
 * The refund amount is computed here, from the booking's policy snapshot, and
 * is bounded by what was actually paid. Stripe only moves the money.
 */
export class CancelBookingUseCase {
  constructor(
    private readonly bookings: BookingGateway,
    private readonly payouts: PayoutGateway,
    private readonly refunds: RefundPort | null,
    private readonly reversals: ReversalPort | null = null,
  ) {}

  async execute(input: CancelBookingInput): Promise<CancelBookingOutput> {
    const booking = await this.bookings.getById(input.bookingId);
    if (!booking) throw new BookingNotFoundError();

    const isParticipant =
      booking.guest_id === input.actorId ||
      booking.owner_id === input.actorId ||
      booking.host_id === input.actorId;
    if (!isParticipant && input.actorRole !== 'admin') {
      throw new BookingPermissionError();
    }

    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      return {
        booking,
        refundMinor: Number(booking.refund_amount_minor ?? 0),
        tier: 'none',
        reason: 'This booking was already cancelled.',
        refundSent: false,
        changed: false,
      };
    }

    if (!canTransition(booking.status, 'cancelled')) {
      throw new BookingValidationError(
        `A ${booking.status.replace('_', ' ')} booking cannot be cancelled`,
      );
    }

    const paid = booking.stripe_payment_intent_id ? Number(booking.total_amount_minor) : 0;
    const policy = policyFromSnapshot(
      booking.cancellation_policy_key,
      booking.cancellation_policy_snapshot,
    );

    const refund = calculateRefund({
      checkin: booking.checkin,
      paidMinor: paid,
      nightlySubtotalMinor: Number(booking.nightly_subtotal_minor),
      policy,
      now: input.now,
    });

    const cancelled = await this.bookings.transition(
      booking.id,
      ['pending_payment', 'reserved', 'confirmed'],
      'cancelled',
      {
        cancelled_at: new Date().toISOString(),
        cancelled_by: input.actorId,
        refund_amount_minor: refund.refundMinor,
      },
    );

    if (!cancelled) {
      const current = await this.bookings.getById(booking.id);
      if (current && !isLiveStatus(current.status)) {
        return {
          booking: current,
          refundMinor: Number(current.refund_amount_minor ?? 0),
          tier: refund.tier,
          reason: 'This booking was already cancelled.',
          refundSent: false,
          changed: false,
        };
      }
      throw new BookingValidationError('The booking changed while cancelling; please retry');
    }

    // Payouts that have not left the platform are simply voided; ones already
    // transferred have to be clawed back, or the platform eats the refund.
    const payout = await this.payouts.getByBookingId(booking.id);
    if (payout && (payout.status === 'held' || payout.status === 'releasable')) {
      await this.payouts.updateStatus(payout.id, 'failed', {
        failure_reason: 'booking_cancelled',
      });
    } else if (payout && payout.status === 'released' && refund.refundMinor > 0) {
      await this.reverseReleasedPayout(booking.id, payout, refund.refundMinor);
    }

    let refundSent = false;
    if (refund.refundMinor > 0 && booking.stripe_payment_intent_id && this.refunds) {
      try {
        await this.refunds.refund(
          booking.stripe_payment_intent_id,
          refund.refundMinor,
          `refund:${booking.id}`,
        );
        refundSent = true;
      } catch (error) {
        // The cancellation stands; an operator has to settle the refund.
        console.error(`Refund failed for booking ${booking.id}:`, error);
        if (payout) {
          await this.payouts.updateStatus(payout.id, 'failed', {
            failure_reason: 'refund_failed',
          });
        }
      }
    }

    return {
      booking: cancelled,
      refundMinor: refund.refundMinor,
      tier: refund.tier,
      reason: refund.reason,
      refundSent,
      changed: true,
    };
  }

  /**
   * Claws back the refund from payees whose transfers already went out.
   *
   * Allocation is proportional to what each slot received; the platform absorbs
   * its own share and any rounding remainder. Idempotency keys are stable per
   * booking+slot so a retry cannot reverse twice.
   */
  private async reverseReleasedPayout(
    bookingId: string,
    payout: Payout,
    refundMinor: number,
  ): Promise<void> {
    const allocations = planReversals(payout, refundMinor);
    if (allocations.length === 0) return;

    if (!this.reversals) {
      await this.payouts.updateStatus(payout.id, 'released', {
        failure_reason: 'reversal_required',
      });
      return;
    }

    const references: Record<string, string> = {};
    for (const [key, value] of Object.entries(payout.reversal_reference ?? {})) {
      if (typeof value === 'string') references[key] = value;
    }
    let reversedOwner = Number(payout.reversed_owner_minor ?? 0);
    let reversedHost = Number(payout.reversed_host_minor ?? 0);
    let failure: string | null = null;

    for (const allocation of allocations) {
      try {
        const reversal = await this.reversals.reverseTransfer(
          allocation.transferId,
          allocation.amountMinor,
          reversalIdempotencyKey(bookingId, allocation.slot),
        );
        references[allocation.slot] = reversal.id;
        if (allocation.slot === 'owner') reversedOwner += allocation.amountMinor;
        else reversedHost += allocation.amountMinor;
      } catch (error) {
        console.error(
          `Transfer reversal failed for booking ${bookingId} (${allocation.slot}):`,
          error,
        );
        failure = 'reversal_failed';
      }
    }

    await this.payouts.updateStatus(payout.id, 'released', {
      reversed_owner_minor: reversedOwner,
      reversed_host_minor: reversedHost,
      reversal_reference: references,
      failure_reason: failure,
    });
  }
}
