import { describe, it, expect, vi } from 'vitest';
import { ConnectOnboardingUseCase } from '../app/core/usecases/connect-onboarding.use';
import type { ProfileGateway } from '../infrastructure/db/profile.gateway';
import type { ConnectPort } from '../app/lib/payments/connect';
import type { Profile } from '../app/core/entities';
import { HttpError } from '../app/lib/http-error';
import { isSupportedPayeeCountry, PAYEE_COUNTRIES } from '../app/lib/payments/countries';

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    id: 'u1',
    email: 'owner@example.com',
    role: 'owner',
    full_name: 'Owner',
    avatar_path: null,
    location_json: {},
    bio: null,
    rating_avg: null,
    rating_count: 0,
    kyc_status: 'none',
    kyc_verified_at: null,
    stripe_connect_id: null,
    stripe_customer_id: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

class FakeConnect implements ConnectPort {
  configured = true;
  created: { email: string; country: string }[] = [];

  isConfigured() {
    return this.configured;
  }

  async createAccount(input: { email: string; country: string }) {
    this.created.push(input);
    return { id: 'acct_1' };
  }

  async createAccountLink() {
    return { url: 'https://connect.stripe.test/onboard' };
  }

  async createAccountSession() {
    return { clientSecret: 'acs_test_secret' };
  }

  async accountStatus() {
    return { chargesEnabled: true, transfersEnabled: true };
  }

  async findTransfer() {
    return null;
  }

  async createTransfer() {
    return { id: 'tr_1' };
  }

  async reverseTransfer() {
    return { id: 'trr_1' };
  }
}

function setup(current: Profile) {
  const update = vi.fn().mockImplementation(async (id: string, patch: Partial<Profile>) => ({
    ...current,
    ...patch,
    id,
  }));
  const profiles = { getById: vi.fn().mockResolvedValue(current), update } as unknown as ProfileGateway;
  const connect = new FakeConnect();
  return { useCase: new ConnectOnboardingUseCase(profiles, connect), connect, update };
}

const urls = { returnUrl: 'https://app.test/back', refreshUrl: 'https://app.test/refresh' };

describe('Connect onboarding', () => {
  it('creates the account once with the payee country and stores it', async () => {
    const { useCase, connect, update } = setup(profile());

    const result = await useCase.execute({ profileId: 'u1', ...urls, country: 'gb' });

    expect(result.created).toBe(true);
    expect(result.url).toContain('stripe.test');
    expect(connect.created).toEqual([{ email: 'owner@example.com', country: 'GB' }]);
    expect(update).toHaveBeenCalledWith('u1', {
      stripe_connect_id: 'acct_1',
      location_json: { country: 'GB' },
    });
  });

  it('requires a country the first time', async () => {
    const { useCase, connect } = setup(profile());
    await expect(useCase.execute({ profileId: 'u1', ...urls })).rejects.toThrow(HttpError);
    expect(connect.created).toHaveLength(0);
  });

  it('refuses countries outside the cross-border corridor', async () => {
    const { useCase, connect } = setup(profile());
    // Dubai is a listing city, but not a supported payout country.
    await expect(
      useCase.execute({ profileId: 'u1', ...urls, country: 'AE' }),
    ).rejects.toThrow(/not available/i);
    expect(connect.created).toHaveLength(0);
  });

  it('reuses an existing account without requiring a country', async () => {
    const { useCase, connect, update } = setup(
      profile({ stripe_connect_id: 'acct_existing', location_json: { country: 'CA' } }),
    );

    const result = await useCase.execute({ profileId: 'u1', ...urls });

    expect(result.created).toBe(false);
    expect(result.accountId).toBe('acct_existing');
    expect(connect.created).toHaveLength(0);
    expect(update).not.toHaveBeenCalled();
  });

  it('refuses when Stripe is not configured', async () => {
    const { useCase, connect } = setup(profile());
    connect.configured = false;
    await expect(useCase.execute({ profileId: 'u1', ...urls, country: 'GB' })).rejects.toMatchObject(
      { status: 503 },
    );
  });
});

describe('payee country allow-list', () => {
  it('covers the launch corridor', () => {
    for (const code of ['CA', 'US', 'GB', 'IE', 'NL', 'DE', 'FR', 'ES', 'CH']) {
      expect(isSupportedPayeeCountry(code)).toBe(true);
    }
  });

  it('excludes countries self-serve cross-border payouts cannot reach', () => {
    for (const code of ['AE', 'SG', 'JP', 'AU', 'BR']) {
      expect(isSupportedPayeeCountry(code)).toBe(false);
    }
  });

  it('has no duplicate codes', () => {
    const codes = PAYEE_COUNTRIES.map((country) => country.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});
