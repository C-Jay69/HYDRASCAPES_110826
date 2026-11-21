import { describe, it, expect, afterEach } from 'vitest';
import { lifecycleTarget, COMPLETION_DELAY_HOURS } from '../app/lib/bookings/lifecycle';
import {
  payoutIsDue,
  pendingTransfers,
  isFullyTransferred,
  transferIdempotencyKey,
  transferGroup,
  transferAmountMinor,
} from '../app/lib/payments/release';
import type { Payout } from '../app/core/entities';
import { requireInternalToken } from '../app/lib/internal-auth';
import { HttpError } from '../app/lib/http-error';

function payout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: 'p1',
    booking_id: 'b1',
    owner_id: 'o1',
    host_id: null,
    settlement_base_minor: 25000,
    owner_amount_minor: 20500,
    host_amount_minor: 0,
    platform_amount_minor: 4500,
    owner_pct_snapshot: 82,
    host_pct_snapshot: 15,
    platform_pct_snapshot: 3,
    currency: 'USD',
    status: 'held',
    releasable_at: '2026-12-01T00:00:00.000Z',
    stripe_transfer_owner_id: null,
    stripe_transfer_host_id: null,
    failure_reason: null,
    released_at: null,
    created_at: '2026-11-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('booking lifecycle', () => {
  const base = { checkin: '2026-12-10', checkout: '2026-12-13' };

  it('checks in a confirmed booking on the check-in date', () => {
    expect(
      lifecycleTarget({ ...base, status: 'confirmed', now: new Date('2026-12-09T23:00:00Z') }),
    ).toBeNull();
    expect(
      lifecycleTarget({ ...base, status: 'confirmed', now: new Date('2026-12-10T00:00:00Z') }),
    ).toBe('checked_in');
  });

  it('checks out a checked-in booking on the checkout date', () => {
    expect(
      lifecycleTarget({ ...base, status: 'checked_in', now: new Date('2026-12-12T23:59:00Z') }),
    ).toBeNull();
    expect(
      lifecycleTarget({ ...base, status: 'checked_in', now: new Date('2026-12-13T00:00:00Z') }),
    ).toBe('checked_out');
  });

  it('completes only after the delay', () => {
    const beforeDelay = new Date(`2026-12-13T${String(COMPLETION_DELAY_HOURS - 1).padStart(2, '0')}:00:00Z`);
    const afterDelay = new Date(`2026-12-14T00:00:00Z`);
    expect(lifecycleTarget({ ...base, status: 'checked_out', now: beforeDelay })).toBeNull();
    expect(lifecycleTarget({ ...base, status: 'checked_out', now: afterDelay })).toBe('completed');
  });

  it('never moves terminal or unrelated states', () => {
    for (const status of ['pending_payment', 'completed', 'cancelled', 'refunded'] as const) {
      expect(lifecycleTarget({ ...base, status, now: new Date('2030-01-01T00:00:00Z') })).toBeNull();
    }
  });
});

describe('payout release rules', () => {
  const now = new Date('2026-12-02T00:00:00Z');

  it('is due only after releasable_at', () => {
    expect(payoutIsDue(payout(), now)).toBe(true);
    expect(payoutIsDue(payout({ releasable_at: '2026-12-05T00:00:00Z' }), now)).toBe(false);
  });

  it('never touches frozen, released or failed payouts', () => {
    expect(payoutIsDue(payout({ status: 'frozen' }), now)).toBe(false);
    expect(payoutIsDue(payout({ status: 'released' }), now)).toBe(false);
    expect(payoutIsDue(payout({ status: 'failed' }), now)).toBe(false);
    expect(payoutIsDue(payout({ released_at: '2026-12-01T00:00:00Z' }), now)).toBe(false);
  });

  it('lists the owner slot when no transfer exists', () => {
    expect(pendingTransfers(payout())).toEqual(['owner']);
    expect(isFullyTransferred(payout())).toBe(false);
  });

  it('includes the host slot when a host is owed money', () => {
    const withHost = payout({ host_id: 'h1', host_amount_minor: 3750, owner_amount_minor: 16750 });
    expect(pendingTransfers(withHost)).toEqual(['owner', 'host']);
  });

  it('does not pay a host slot with zero amount', () => {
    expect(pendingTransfers(payout({ host_id: 'h1', host_amount_minor: 0 }))).toEqual(['owner']);
  });

  it('skips slots already transferred', () => {
    const partially = payout({ stripe_transfer_owner_id: 'tr_1' });
    expect(pendingTransfers(partially)).toEqual([]);
    expect(isFullyTransferred(partially)).toBe(true);
  });

  it('uses the documented idempotency key shapes', () => {
    expect(transferIdempotencyKey('abc', 'owner')).toBe('booking:abc:owner');
    expect(transferIdempotencyKey('abc', 'host')).toBe('booking:abc:host');
    expect(transferGroup('abc')).toBe('booking:abc');
  });

  it('transfers the slot amount, not the whole payout', () => {
    const withHost = payout({ host_id: 'h1', host_amount_minor: 3750 });
    expect(transferAmountMinor(withHost, 'owner')).toBe(20500);
    expect(transferAmountMinor(withHost, 'host')).toBe(3750);
  });
});


describe('internal route authentication', () => {
  const original = process.env.INTERNAL_API_TOKEN;

  afterEach(() => {
    if (original === undefined) delete process.env.INTERNAL_API_TOKEN;
    else process.env.INTERNAL_API_TOKEN = original;
  });

  function request(authorization?: string): Request {
    return new Request('http://localhost/api/internal/payouts/release', {
      method: 'POST',
      headers: authorization ? { authorization } : {},
    });
  }

  it('refuses when no token is configured', () => {
    delete process.env.INTERNAL_API_TOKEN;
    expect(() => requireInternalToken(request('Bearer anything'))).toThrow(HttpError);
  });

  it('rejects a missing or wrong bearer token', () => {
    process.env.INTERNAL_API_TOKEN = 'expected-token';
    expect(() => requireInternalToken(request())).toThrow(/Invalid internal token/);
    expect(() => requireInternalToken(request('Bearer nope'))).toThrow(/Invalid internal token/);
    expect(() => requireInternalToken(request('Basic expected-token'))).toThrow(HttpError);
  });

  it('accepts the configured token', () => {
    process.env.INTERNAL_API_TOKEN = 'expected-token';
    expect(() => requireInternalToken(request('Bearer expected-token'))).not.toThrow();
  });
});
