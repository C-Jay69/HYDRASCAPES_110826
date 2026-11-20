/**
 * Phase 3 acceptance tests (spec §5.3, §29).
 *
 * These are INTEGRATION tests: they need the local Supabase stack running
 * (`supabase start && supabase db reset`). They assert the database — not the
 * application layer — is what actually prevents double booking.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { serviceClient, IDS } from './helpers/supabase';
import { SupabaseBookingGateway } from '../infrastructure/db/booking.gateway';
import { SupabasePayoutGateway } from '../infrastructure/db/payout.gateway';
import { ConfirmBookingUseCase } from '../app/core/usecases/confirm-booking.use';
import type { BookingState } from '../app/core/entities';

const service = serviceClient();

/**
 * Dates vary per run so a crashed run does not block the next one, and stay
 * inside 2031 so they never collide with seeded fixture bookings.
 */
const day = (Date.now() % 27) + 1;
const checkin = `2031-03-${String(day).padStart(2, '0')}`;
const checkout = `2031-03-${String(day + 3).padStart(2, '0')}`;

function bookingRow(id: string, guestId: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    property_id: '20000000-0000-0000-0000-000000000015',
    guest_id: guestId,
    host_id: null,
    owner_id: IDS.sarah,
    checkin,
    checkout,
    guests_count: 2,
    per_night_rate_minor: 10000,
    nightly_subtotal_minor: 20000,
    cleaning_fee_minor: 5000,
    taxes_minor: 0,
    total_amount_minor: 25000,
    currency: 'USD',
    status: 'pending_payment' as BookingState,
    cancellation_policy_key: 'moderate',
    cancellation_policy_version: 1,
    cancellation_policy_snapshot: {
      key: 'moderate',
      version: 1,
      label: 'Moderate',
      full_refund_hours: 120,
      partial_refund_hours: 48,
      partial_refund_pct: 50,
    },
    guest_preferences: {},
    ...overrides,
  };
}

const createdIds: string[] = [];

afterAll(async () => {
  if (createdIds.length > 0) {
    await service.from('payouts').delete().in('booking_id', createdIds);
    await service.from('bookings').delete().in('id', createdIds);
  }
});

describe('double booking', () => {
  it('ten concurrent attempts for identical dates produce exactly one reservation', async () => {
    const guests = [
      IDS.alice,
      IDS.bob,
      IDS.hannah,
      IDS.george,
      IDS.grace,
      IDS.adam,
      IDS.elena,
      IDS.alice,
      IDS.bob,
      IDS.hannah,
    ];

    const ids = guests.map((_, index) => `b1000000-0000-4000-8000-${String(index).padStart(12, '0')}`);
    createdIds.push(...ids);

    const attempts = ids.map((id, index) =>
      service.from('bookings').insert([bookingRow(id, guests[index])]).select('id').single(),
    );

    const results = await Promise.all(attempts);
    const winners = results.filter((result) => !result.error);
    const conflicts = results.filter((result) => result.error);

    expect(winners).toHaveLength(1);
    expect(conflicts).toHaveLength(9);
    // Postgres exclusion violations, not application-level rejections.
    for (const conflict of conflicts) {
      expect(conflict.error?.code).toBe('23P01');
    }
  });

  it('allows non-overlapping dates on the same property', async () => {
    const ids = ['b2000000-0000-4000-8000-000000000001', 'b2000000-0000-4000-8000-000000000002'];
    createdIds.push(...ids);

    const later = {
      checkin: '2031-06-10',
      checkout: '2031-06-13',
    };
    const evenLater = {
      checkin: '2031-06-13',
      checkout: '2031-06-15',
    };

    const [first, second] = await Promise.all([
      service.from('bookings').insert([bookingRow(ids[0], IDS.alice, later)]).select('id').single(),
      service
        .from('bookings')
        .insert([bookingRow(ids[1], IDS.bob, evenLater)])
        .select('id')
        .single(),
    ]);

    // Back-to-back ranges are not overlaps: checkout day is free for the next guest.
    expect(first.error).toBeNull();
    expect(second.error).toBeNull();
  });
});

describe('payment confirmation idempotency', () => {
  it('creates exactly one payout when the confirmation runs twice', async () => {
    const bookingId = 'b3000000-0000-4000-8000-000000000001';
    createdIds.push(bookingId);

    const insert = await service
      .from('bookings')
      .insert([bookingRow(bookingId, IDS.alice, { checkin: '2031-09-01', checkout: '2031-09-04' })])
      .select('id')
      .single();
    expect(insert.error).toBeNull();

    const bookings = new SupabaseBookingGateway(service);
    const payouts = new SupabasePayoutGateway(service);
    const confirm = new ConfirmBookingUseCase(bookings, payouts);

    const first = await confirm.execute({ bookingId, paymentIntentId: 'pi_test_123' });
    const second = await confirm.execute({ bookingId, paymentIntentId: 'pi_test_123' });

    expect(first.changed).toBe(true);
    expect(second.changed).toBe(false);

    const { count } = await service
      .from('payouts')
      .select('id', { count: 'exact', head: true })
      .eq('booking_id', bookingId);

    expect(count).toBe(1);
  });

  it('payout amounts reconcile to the booking total', async () => {
    const bookingId = 'b3000000-0000-4000-8000-000000000002';
    createdIds.push(bookingId);

    await service
      .from('bookings')
      .insert([bookingRow(bookingId, IDS.bob, { checkin: '2031-10-01', checkout: '2031-10-03' })])
      .select('id')
      .single();

    const bookings = new SupabaseBookingGateway(service);
    const payouts = new SupabasePayoutGateway(service);
    await new ConfirmBookingUseCase(bookings, payouts).execute({ bookingId });

    const payout = await payouts.getByBookingId(bookingId);
    expect(payout).not.toBeNull();
    expect(
      payout!.owner_amount_minor + payout!.host_amount_minor + payout!.platform_amount_minor,
    ).toBe(25000);
    expect(payout!.status).toBe('held');
  });
});

describe('stale hold expiry', () => {
  it('cancels an unpaid hold older than the window, freeing the dates', async () => {
    const bookingId = 'b4000000-0000-4000-8000-000000000001';
    createdIds.push(bookingId);

    await service
      .from('bookings')
      .insert([
        bookingRow(bookingId, IDS.grace, {
          checkin: '2031-11-01',
          checkout: '2031-11-03',
          created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        }),
      ])
      .select('id')
      .single();

    const { data, error } = await service.rpc('expire_stale_pending_bookings', { p_minutes: 15 });
    expect(error).toBeNull();
    expect(Number(data)).toBeGreaterThanOrEqual(1);

    const { data: row } = await service
      .from('bookings')
      .select('status')
      .eq('id', bookingId)
      .single();
    expect(row?.status).toBe('cancelled');
  });
});
