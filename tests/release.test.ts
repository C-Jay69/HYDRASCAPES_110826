/**
 * Phase 3 acceptance: payout release and lifecycle progression (spec §15.1).
 *
 * INTEGRATION tests — they need the local Supabase stack running. Transfers
 * use a fake Connect port, so nothing talks to Stripe: what is being tested is
 * our state machine, idempotency and reconciliation logic against the real
 * database.
 */

import { describe, it, expect, afterAll, beforeAll } from 'vitest';
import { serviceClient, IDS } from './helpers/supabase';
import { SupabaseBookingGateway } from '../infrastructure/db/booking.gateway';
import { SupabasePayoutGateway } from '../infrastructure/db/payout.gateway';
import { SupabaseProfileGateway } from '../infrastructure/db/profile.gateway';
import { ConfirmBookingUseCase } from '../app/core/usecases/confirm-booking.use';
import { ReleasePayoutsUseCase } from '../app/core/usecases/release-payouts.use';
import { AdvanceBookingsUseCase } from '../app/core/usecases/advance-bookings.use';
import type { ConnectPort, CreateTransferInput } from '../app/lib/payments/connect';
import type { TransferSlot } from '../app/lib/payments/release';

const service = serviceClient();
const bookings = new SupabaseBookingGateway(service);
const payouts = new SupabasePayoutGateway(service);
const profiles = new SupabaseProfileGateway(service);

const OWNER = IDS.sarah;
const ACCOUNT = 'acct_test_owner_release';

class FakeConnect implements ConnectPort {
  configured = true;
  unverified = new Set<string>();
  transfers: { id: string; group: string; slot: TransferSlot; amount: number }[] = [];
  private counter = 0;

  isConfigured() {
    return this.configured;
  }

  async createAccount() {
    return { id: 'acct_created' };
  }

  async createAccountLink() {
    return { url: 'https://connect.stripe.test/onboard' };
  }

  async accountStatus(accountId: string) {
    return { chargesEnabled: true, payoutsEnabled: !this.unverified.has(accountId) };
  }

  async findTransfer(group: string, slot: TransferSlot) {
    return this.transfers.find((t) => t.group === group && t.slot === slot)?.id ?? null;
  }

  async createTransfer(input: CreateTransferInput) {
    this.counter += 1;
    const id = `tr_test_${this.counter}`;
    this.transfers.push({
      id,
      group: input.transferGroup,
      slot: input.slot,
      amount: input.amountMinor,
    });
    return { id };
  }
}

const createdBookings: string[] = [];

function bookingRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    property_id: '20000000-0000-0000-0000-000000000013',
    guest_id: IDS.alice,
    host_id: null,
    owner_id: OWNER,
    checkin: '2032-02-10',
    checkout: '2032-02-13',
    guests_count: 2,
    per_night_rate_minor: 10000,
    nightly_subtotal_minor: 30000,
    cleaning_fee_minor: 5000,
    taxes_minor: 0,
    total_amount_minor: 35000,
    currency: 'USD',
    status: 'pending_payment',
    cancellation_policy_key: 'moderate',
    cancellation_policy_version: 1,
    cancellation_policy_snapshot: {},
    guest_preferences: {},
    ...overrides,
  };
}

async function makeConfirmedBooking(id: string, overrides: Record<string, unknown> = {}) {
  createdBookings.push(id);
  const insert = await service.from('bookings').insert([bookingRow(id, overrides)]).select('id').single();
  if (insert.error) throw new Error(`insert booking: ${insert.error.message}`);

  await new ConfirmBookingUseCase(bookings, payouts).execute({
    bookingId: id,
    paymentIntentId: `pi_${id}`,
  });
  return id;
}

/** Moves a payout's release time into the past so it is due now. */
async function makeDue(bookingId: string) {
  const payout = await payouts.getByBookingId(bookingId);
  if (!payout) throw new Error('payout missing');
  await service
    .from('payouts')
    .update({ releasable_at: new Date(Date.now() - 60_000).toISOString() })
    .eq('id', payout.id);
  return payout;
}

beforeAll(async () => {
  await service.from('profiles').update({ stripe_connect_id: ACCOUNT }).eq('id', OWNER);
});

afterAll(async () => {
  if (createdBookings.length > 0) {
    await service.from('payouts').delete().in('booking_id', createdBookings);
    await service.from('bookings').delete().in('id', createdBookings);
  }
  await service.from('profiles').update({ stripe_connect_id: null }).eq('id', OWNER);
});

describe('payout release', () => {
  it('releases a due payout exactly once', async () => {
    const bookingId = 'c1000000-0000-4000-8000-000000000001';
    // Distinct dates per test: the exclusion constraint is per property.
    await makeConfirmedBooking(bookingId, { checkin: '2032-02-10', checkout: '2032-02-13' });
    const payout = await makeDue(bookingId);

    const connect = new FakeConnect();
    const useCase = new ReleasePayoutsUseCase(payouts, profiles, connect);

    const group = `booking:${bookingId}`;
    const transfersForBooking = () => connect.transfers.filter((t) => t.group === group);

    const first = await useCase.execute();
    expect(first.released).toContain(payout.id);
    expect(transfersForBooking()).toHaveLength(1);
    expect(transfersForBooking()[0].amount).toBe(Number(payout.owner_amount_minor));

    // A second run must reconcile, not pay again.
    const second = await useCase.execute();
    expect(second.released).not.toContain(payout.id);
    expect(transfersForBooking()).toHaveLength(1);

    const released = await payouts.getByBookingId(bookingId);
    expect(released?.status).toBe('released');
    expect(released?.stripe_transfer_owner_id).toBe(connect.transfers[0].id);
    expect(released?.released_at).not.toBeNull();
  });

  it('skips and records why when the owner has no Connect account', async () => {
    const bookingId = 'c1000000-0000-4000-8000-000000000002';
    await makeConfirmedBooking(bookingId, { checkin: '2032-03-10', checkout: '2032-03-13' });
    const payout = await makeDue(bookingId);

    await service.from('profiles').update({ stripe_connect_id: null }).eq('id', OWNER);
    const connect = new FakeConnect();

    try {
      const result = await new ReleasePayoutsUseCase(payouts, profiles, connect).execute();
      expect(result.released).not.toContain(payout.id);
      expect(result.skipped.some((s) => s.payoutId === payout.id)).toBe(true);
      expect(connect.transfers.filter((t) => t.group === `booking:${bookingId}`)).toHaveLength(0);

      const stuck = await payouts.getByBookingId(bookingId);
      expect(stuck?.status).toBe('releasable');
      expect(stuck?.failure_reason).toBe('owner_not_onboarded');
    } finally {
      await service.from('profiles').update({ stripe_connect_id: ACCOUNT }).eq('id', OWNER);
    }
  });

  it('never touches a frozen payout', async () => {
    const bookingId = 'c1000000-0000-4000-8000-000000000003';
    await makeConfirmedBooking(bookingId, { checkin: '2032-04-10', checkout: '2032-04-13' });
    const payout = await makeDue(bookingId);
    await service.from('payouts').update({ status: 'frozen' }).eq('id', payout.id);

    const connect = new FakeConnect();
    const result = await new ReleasePayoutsUseCase(payouts, profiles, connect).execute();

    expect(result.released).not.toContain(payout.id);
    expect(connect.transfers.filter((t) => t.group === `booking:${bookingId}`)).toHaveLength(0);
    expect((await payouts.getByBookingId(bookingId))?.status).toBe('frozen');
  });

  it('does nothing when Stripe is not configured', async () => {
    const connect = new FakeConnect();
    connect.configured = false;
    const result = await new ReleasePayoutsUseCase(payouts, profiles, connect).execute();
    expect(result.configured).toBe(false);
    expect(result.released).toHaveLength(0);
  });
});

describe('booking lifecycle advancement', () => {
  it('moves a confirmed stay into checked_in once the date arrives', async () => {
    const bookingId = 'c2000000-0000-4000-8000-000000000001';
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

    createdBookings.push(bookingId);
    await service
      .from('bookings')
      .insert([
        bookingRow(bookingId, {
          status: 'confirmed',
          checkin: yesterday,
          checkout: tomorrow,
        }),
      ])
      .select('id')
      .single();

    const result = await new AdvanceBookingsUseCase(bookings).execute();
    expect(result.advanced.some((a) => a.bookingId === bookingId && a.to === 'checked_in')).toBe(
      true,
    );

    const updated = await bookings.getById(bookingId);
    expect(updated?.status).toBe('checked_in');
  });

  it('is idempotent when run again', async () => {
    const result = await new AdvanceBookingsUseCase(bookings).execute();
    expect(result.advanced.some((a) => a.bookingId === 'c2000000-0000-4000-8000-000000000001')).toBe(
      false,
    );
  });
});
