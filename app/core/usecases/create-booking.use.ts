import type { BookingGateway, NewBooking } from '@/infrastructure/db/booking.gateway';
import type { Booking, CancellationPolicyKey, Property } from '@/app/core/entities';
import { buildQuote, type Quote } from '@/app/lib/bookings/quote';
import { getCancellationPolicy, snapshotPolicy } from '@/app/lib/bookings/policies';
import { BookingConflictError, BookingValidationError } from '@/app/lib/bookings/errors';

/** Postgres exclusion-constraint violation (double booking). */
const EXCLUSION_VIOLATION = '23P01';

export interface CreateBookingInput {
  property: Property;
  guestId: string;
  checkin: string;
  checkout: string;
  guestsCount: number;
  policyKey?: CancellationPolicyKey;
  guestsNotes?: string;
}

export interface CreateBookingOutput {
  booking: Booking;
  quote: Quote;
}

/**
 * Creates an unpaid booking and holds the dates.
 *
 * The application-level conflict check exists to give a good error message;
 * the database exclusion constraint is what actually prevents a race. When
 * both writers pass the check, the second insert fails with 23P01 and is
 * reported as a conflict instead of a 500.
 */
export class CreateBookingUseCase {
  constructor(private readonly bookings: BookingGateway) {}

  async execute(input: CreateBookingInput): Promise<CreateBookingOutput> {
    const { property } = input;

    if (property.status !== 'listed') {
      throw new BookingValidationError('This property is not accepting bookings');
    }
    if (property.owner_id === input.guestId) {
      throw new BookingValidationError('You cannot book your own property');
    }

    const quote = buildQuote({
      basePriceMinor: Number(property.base_price_minor),
      cleaningFeeMinor: Number(property.cleaning_fee_minor),
      currency: property.currency,
      checkin: input.checkin,
      checkout: input.checkout,
      guestsCount: input.guestsCount,
      maxGuests: property.max_guests,
    });

    const conflicts = await this.bookings.findConflicts(
      property.id,
      input.checkin,
      input.checkout,
    );
    if (conflicts.length > 0) {
      throw new BookingConflictError();
    }

    const blocked = await this.bookings.blockedWindows(
      property.id,
      input.checkin,
      input.checkout,
    );
    if (blocked.length > 0) {
      throw new BookingConflictError('The owner has blocked those dates');
    }

    const policy = getCancellationPolicy(input.policyKey ?? 'moderate');

    const record: NewBooking = {
      id: crypto.randomUUID(),
      property_id: property.id,
      guest_id: input.guestId,
      host_id: property.assigned_host_id,
      owner_id: property.owner_id,
      checkin: input.checkin,
      checkout: input.checkout,
      guests_count: input.guestsCount,
      per_night_rate_minor: quote.perNightRateMinor,
      nightly_subtotal_minor: quote.nightlySubtotalMinor,
      cleaning_fee_minor: quote.cleaningFeeMinor,
      taxes_minor: quote.taxesMinor,
      total_amount_minor: quote.totalMinor,
      currency: quote.currency,
      status: 'pending_payment',
      stripe_payment_intent_id: null,
      stripe_charge_id: null,
      cancellation_policy_key: policy.key,
      cancellation_policy_version: policy.version,
      cancellation_policy_snapshot: snapshotPolicy(policy),
      guest_preferences: input.guestsNotes ? { notes: input.guestsNotes } : {},
    };

    try {
      const booking = await this.bookings.create(record);
      return { booking, quote };
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new BookingConflictError();
      }
      throw error;
    }
  }
}

function isExclusionViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: string }).code === EXCLUSION_VIOLATION
  );
}
