import type { BookingGateway } from '@/infrastructure/db/booking.gateway';
import type { BookingState } from '@/app/core/entities';
import { lifecycleTarget } from '@/app/lib/bookings/lifecycle';

export interface AdvanceBookingsInput {
  now?: Date;
}

export interface AdvanceBookingsOutput {
  advanced: { bookingId: string; from: BookingState; to: BookingState }[];
  examined: number;
}

/**
 * Advances trips whose dates say they should have moved on (spec §5.4).
 *
 * Run on a schedule (or by the internal route). Each transition is applied
 * with an optimistic status guard, so two concurrent runs cannot double-apply.
 */
export class AdvanceBookingsUseCase {
  constructor(private readonly bookings: BookingGateway) {}

  async execute(input: AdvanceBookingsInput = {}): Promise<AdvanceBookingsOutput> {
    const now = input.now ?? new Date();
    const candidates = await this.bookings.listByStatuses([
      'confirmed',
      'checked_in',
      'checked_out',
    ]);

    const advanced: AdvanceBookingsOutput['advanced'] = [];

    for (const booking of candidates) {
      const target = lifecycleTarget({
        status: booking.status,
        checkin: booking.checkin,
        checkout: booking.checkout,
        now,
      });
      if (!target) continue;

      const updated = await this.bookings.transition(booking.id, [booking.status], target);
      if (updated) {
        advanced.push({ bookingId: booking.id, from: booking.status, to: target });
      }
    }

    return { advanced, examined: candidates.length };
  }
}
