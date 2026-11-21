/**
 * Webhook event semantics (Stripe plan review, findings #1 and #6).
 *
 * Unit tests with in-memory fakes: no Stripe, no database. They pin the
 * decisions that matter — a payment arriving after cancellation is refunded,
 * an expired session releases the dates, and the charged amount (which may
 * include automatic tax) is what gets confirmed.
 */

import { describe, it, expect, vi } from 'vitest';
import { ApplyStripeEventUseCase } from '../app/core/usecases/apply-stripe-event.use';
import type { BookingGateway } from '../infrastructure/db/booking.gateway';
import type { ConfirmBookingUseCase } from '../app/core/usecases/confirm-booking.use';
import type { Booking } from '../app/core/entities';
import {
  HOLD_MINUTES,
  CHECKOUT_SESSION_MINUTES,
  checkoutExpiresAt,
  holdOutlivesSession,
} from '../app/lib/bookings/holds';

function booking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'b1',
    property_id: 'p1',
    guest_id: 'g1',
    host_id: null,
    owner_id: 'o1',
    checkin: '2031-08-01',
    checkout: '2031-08-04',
    nights: 3,
    guests_count: 2,
    per_night_rate_minor: 34000,
    nightly_subtotal_minor: 102000,
    cleaning_fee_minor: 9000,
    taxes_minor: 0,
    total_amount_minor: 111000,
    currency: 'GBP',
    status: 'pending_payment',
    stripe_payment_intent_id: null,
    stripe_charge_id: null,
    cancellation_policy_key: 'moderate',
    cancellation_policy_version: 1,
    cancellation_policy_snapshot: {},
    cancelled_at: null,
    cancelled_by: null,
    refund_amount_minor: null,
    guest_preferences: {},
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function setup(current: Booking, payout: { id: string; status: string } | null = null) {
  const getById = vi.fn().mockResolvedValue(current);
  const findByPaymentIntent = vi.fn().mockResolvedValue(current);
  const findByChargeId = vi.fn().mockResolvedValue(current);
  const update = vi.fn().mockImplementation(async (_id: string, patch: Partial<Booking>) => ({
    ...current,
    ...patch,
  }));
  const transition = vi.fn().mockImplementation(async (_id, _from, to, extra = {}) => ({
    ...current,
    ...extra,
    status: to,
  }));

  const bookings = {
    getById,
    findByPaymentIntent,
    findByChargeId,
    update,
    transition,
    findConflicts: vi.fn(),
    blockedWindows: vi.fn(),
    create: vi.fn(),
    listByGuest: vi.fn(),
    listByProperty: vi.fn(),
    listByStatuses: vi.fn(),
    setPaymentIntent: vi.fn(),
    revenueSplit: vi.fn(),
    processingFees: vi.fn(),
  } as unknown as BookingGateway;

  const confirm = {
    execute: vi.fn().mockResolvedValue({ booking: current, changed: true }),
  } as unknown as ConfirmBookingUseCase;

  const refunds = {
    refund: vi.fn().mockResolvedValue({ id: 're_1', status: 'succeeded' }),
  };

  const payoutStore = {
    getByBookingId: vi.fn().mockResolvedValue(payout),
    updateStatus: vi.fn().mockImplementation(async (id: string, status: string, extra = {}) => ({
      id,
      status,
      ...extra,
    })),
  };

  const useCase = new ApplyStripeEventUseCase(
    bookings,
    confirm,
    refunds,
    payoutStore as never,
  );
  return { useCase, bookings, confirm, refunds, getById, update, transition, payoutStore };
}

const sessionCompleted = (bookingId: string, amountTotal: number, tax: number) => ({
  id: 'evt_1',
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_1',
      amount_total: amountTotal,
      total_details: { amount_tax: tax },
      payment_intent: 'pi_1',
      metadata: { booking_id: bookingId },
    },
  },
});

describe('checkout.session.completed', () => {
  it('confirms with the charged amount, including automatic tax', async () => {
    const { useCase, confirm } = setup(booking());

    const result = await useCase.execute(sessionCompleted('b1', 118000, 7000));

    expect(result.outcome).toBe('handled');
    expect(confirm.execute).toHaveBeenCalledWith({
      bookingId: 'b1',
      paymentIntentId: 'pi_1',
      paidTotalMinor: 118000,
      taxMinor: 7000,
    });
  });

  it('refunds in full when the booking was cancelled before payment arrived', async () => {
    const { useCase, confirm, refunds, transition } = setup(
      booking({ status: 'cancelled', stripe_payment_intent_id: 'pi_1' }),
    );

    const result = await useCase.execute(sessionCompleted('b1', 118000, 7000));

    expect(confirm.execute).not.toHaveBeenCalled();
    expect(refunds.refund).toHaveBeenCalledWith('pi_1', 118000, 'refund:late:b1');
    expect(transition).toHaveBeenCalledWith('b1', ['cancelled'], 'refunded', {
      refund_amount_minor: 118000,
    });
    expect(result.detail).toMatch(/refunded/);
  });

  it('records a manual refund when no refund capability is available', async () => {
    const current = booking({ status: 'cancelled', stripe_payment_intent_id: 'pi_1' });
    const bookings = {
      getById: vi.fn().mockResolvedValue(current),
      findByPaymentIntent: vi.fn(),
      update: vi.fn().mockResolvedValue(current),
      transition: vi.fn(),
    } as unknown as BookingGateway;
    const confirm = { execute: vi.fn() } as unknown as ConfirmBookingUseCase;

    const useCase = new ApplyStripeEventUseCase(bookings, confirm, null);
    const result = await useCase.execute(sessionCompleted('b1', 118000, 7000));

    expect(confirm.execute).not.toHaveBeenCalled();
    expect(bookings.update).toHaveBeenCalledWith('b1', { refund_amount_minor: 118000 });
    expect(result.detail).toMatch(/manual refund required/);
  });

  it('ignores events for unknown bookings', async () => {
    const { useCase } = setup(booking());
    const result = await useCase.execute({
      id: 'evt_x',
      type: 'checkout.session.completed',
      data: { object: { id: 'cs_x', metadata: {} } },
    });
    expect(result.outcome).toBe('ignored');
  });
});

describe('checkout.session.expired', () => {
  it('releases the dates of an unpaid booking', async () => {
    const { useCase, transition } = setup(booking());

    const result = await useCase.execute({
      id: 'evt_2',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_2', metadata: { booking_id: 'b1' } } },
    });

    expect(result.outcome).toBe('handled');
    expect(transition).toHaveBeenCalledWith(
      'b1',
      ['pending_payment'],
      'cancelled',
      expect.objectContaining({ refund_amount_minor: 0 }),
    );
  });

  it('does not touch a booking that already moved on', async () => {
    const { useCase, transition } = setup(booking({ status: 'confirmed' }));

    const result = await useCase.execute({
      id: 'evt_3',
      type: 'checkout.session.expired',
      data: { object: { id: 'cs_3', metadata: { booking_id: 'b1' } } },
    });

    expect(result.outcome).toBe('ignored');
    expect(transition).not.toHaveBeenCalled();
  });
});

describe('payment_intent.payment_failed', () => {
  it('cancels the unpaid hold', async () => {
    const { useCase, transition } = setup(booking());

    const result = await useCase.execute({
      id: 'evt_4',
      type: 'payment_intent.payment_failed',
      data: { object: { id: 'pi_4', metadata: { booking_id: 'b1' } } },
    });

    expect(result.outcome).toBe('handled');
    expect(transition).toHaveBeenCalledWith(
      'b1',
      ['pending_payment', 'reserved'],
      'cancelled',
      expect.objectContaining({ refund_amount_minor: 0 }),
    );
  });
});

describe('hold and session lifetimes', () => {
  it('keeps the hold longer than the session', () => {
    expect(HOLD_MINUTES).toBeGreaterThan(CHECKOUT_SESSION_MINUTES);
    expect(holdOutlivesSession()).toBe(true);
  });

  it('requests a session lifetime Stripe accepts (30 min to 24 h)', () => {
    const now = new Date('2031-01-01T00:00:00Z');
    const expires = checkoutExpiresAt(now);
    const seconds = expires - Math.floor(now.getTime() / 1000);

    expect(seconds).toBeGreaterThanOrEqual(30 * 60);
    expect(seconds).toBeLessThanOrEqual(24 * 60 * 60);
  });
});


describe('risk events freeze payouts', () => {
  it('freezes a held payout when a dispute opens', async () => {
    const { useCase, payoutStore } = setup(
      booking({ status: 'confirmed', stripe_charge_id: 'ch_1' }),
      { id: 'pay_1', status: 'held' },
    );

    const result = await useCase.execute({
      id: 'evt_d1',
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_1', charge: 'ch_1', payment_intent: 'pi_1' } },
    });

    expect(result.outcome).toBe('handled');
    expect(payoutStore.updateStatus).toHaveBeenCalledWith('pay_1', 'frozen', {
      failure_reason: 'dispute_open',
    });
  });

  it('freezes on an early fraud warning', async () => {
    const { useCase, payoutStore } = setup(
      booking({ status: 'confirmed', stripe_charge_id: 'ch_2' }),
      { id: 'pay_2', status: 'releasable' },
    );

    const result = await useCase.execute({
      id: 'evt_f1',
      type: 'radar.early_fraud_warning.created',
      data: { object: { id: 'efw_1', charge: 'ch_2' } },
    });

    expect(result.outcome).toBe('handled');
    expect(payoutStore.updateStatus).toHaveBeenCalledWith('pay_2', 'frozen', {
      failure_reason: 'early_fraud_warning',
    });
  });

  it('records the reason when the payout already left', async () => {
    const { useCase, payoutStore } = setup(
      booking({ status: 'confirmed', stripe_charge_id: 'ch_3' }),
      { id: 'pay_3', status: 'released' },
    );

    const result = await useCase.execute({
      id: 'evt_d2',
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_2', charge: 'ch_3' } },
    });

    expect(result.outcome).toBe('handled');
    expect(result.detail).toMatch(/already released/);
    expect(payoutStore.updateStatus).toHaveBeenCalledWith('pay_3', 'released', {
      failure_reason: 'dispute_open',
    });
  });

  it('ignores a dispute when the booking has no payout yet', async () => {
    const { useCase, payoutStore } = setup(booking(), null);

    const result = await useCase.execute({
      id: 'evt_d3',
      type: 'charge.dispute.created',
      data: { object: { id: 'dp_3', charge: 'ch_3' } },
    });

    expect(result.outcome).toBe('ignored');
    expect(result.detail).toMatch(/no payout/);
    expect(payoutStore.updateStatus).not.toHaveBeenCalled();
  });
});
