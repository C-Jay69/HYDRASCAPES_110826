import { describe, it, expect, afterEach } from 'vitest';
import { requireMcpKey, mcpKeyId } from '../app/lib/mcp/auth';
import { intParam, uuidParam, escapeFilterValue, dateParam } from '../app/lib/mcp/handler';
import { toPropertyDto, toBookingDto, toPayoutDto } from '../app/lib/mcp/serialize';
import { HttpError } from '../app/lib/http-error';
import type { Booking, Payout, Property } from '../app/core/entities';

function mcpRequest(key?: string): Request {
  return new Request('http://localhost/api/mcp/properties', {
    headers: key ? { authorization: `Bearer ${key}` } : {},
  });
}

const original = process.env.MCP_API_KEY;
afterEach(() => {
  if (original === undefined) delete process.env.MCP_API_KEY;
  else process.env.MCP_API_KEY = original;
});

describe('MCP key authentication', () => {
  it('refuses when no key is configured', () => {
    delete process.env.MCP_API_KEY;
    expect(() => requireMcpKey(mcpRequest('anything'))).toThrow(HttpError);
  });

  it('rejects missing, wrong and malformed credentials', () => {
    process.env.MCP_API_KEY = 'correct-key';
    expect(() => requireMcpKey(mcpRequest())).toThrow(/Invalid MCP API key/);
    expect(() => requireMcpKey(mcpRequest('wrong'))).toThrow(/Invalid MCP API key/);
    expect(() => requireMcpKey(mcpRequest(''))).toThrow(/Invalid MCP API key/);
  });

  it('accepts the configured key', () => {
    process.env.MCP_API_KEY = 'correct-key';
    expect(() => requireMcpKey(mcpRequest('correct-key'))).not.toThrow();
  });

  it('derives a stable, non-reversible rate-limit id', () => {
    process.env.MCP_API_KEY = 'correct-key';
    const id = mcpKeyId(mcpRequest('correct-key'));
    expect(id).toHaveLength(12);
    expect(id).toBe(mcpKeyId(mcpRequest('correct-key')));
    expect(id).not.toBe(mcpKeyId(mcpRequest('another-key')));
    expect(id).not.toContain('correct-key');
  });
});

describe('MCP parameter validation', () => {
  it('bounds integers and applies fallbacks', () => {
    const url = new URL('http://x/?limit=5');
    expect(intParam(url, 'limit', { min: 1, max: 10 })).toBe(5);
    expect(intParam(new URL('http://x/'), 'limit', { min: 1, max: 10, fallback: 20 })).toBe(20);

    expect(() => intParam(new URL('http://x/?limit=99'), 'limit', { min: 1, max: 10 })).toThrow(
      HttpError,
    );
    expect(() =>
      intParam(new URL('http://x/?limit=abc'), 'limit', { min: 1, max: 10 }),
    ).toThrow(HttpError);
  });

  it('accepts only date-shaped parameters', () => {
    expect(dateParam(new URL('http://x/?from=2031-01-01'), 'from')).toBe('2031-01-01');
    expect(dateParam(new URL('http://x/'), 'from')).toBeNull();
    expect(() => dateParam(new URL('http://x/?from=01/01/2031'), 'from')).toThrow(HttpError);
    expect(() => dateParam(new URL('http://x/?from=2031-02-30'), 'from')).toThrow(HttpError);
  });

  it('404s malformed ids instead of letting the driver 500', () => {
    expect(uuidParam('20000000-0000-0000-0000-000000000001')).toBe(
      '20000000-0000-0000-0000-000000000001',
    );
    expect(() => uuidParam('not-a-uuid')).toThrow(/not found/);
    try {
      uuidParam('nope');
    } catch (error) {
      expect((error as HttpError).status).toBe(404);
    }
  });

  it('strips PostgREST filter metacharacters', () => {
    expect(escapeFilterValue('London, UK (city)')).toBe('London  UK  city');
    expect(escapeFilterValue('100%')).toBe('100');
  });
});

function property(overrides: Partial<Property> = {}): Property {
  return {
    id: 'p1',
    owner_id: 'o1',
    assigned_host_id: null,
    title: 'Bondi Beachfront Flat',
    description: 'A flat',
    address_json: { city: 'Sydney', country: 'Australia' },
    latitude: null,
    longitude: null,
    bedrooms: 2,
    bathrooms: 1,
    max_guests: 4,
    amenities: ['Balcony'],
    base_price_minor: 34000,
    min_price_minor: 27000,
    max_price_minor: 52000,
    currency: 'AUD',
    cleaning_fee_minor: 9000,
    status: 'listed',
    photos: ['properties/p1/cover.jpg'],
    cover_photo: 'properties/p1/cover.jpg',
    vision_analysis: {
      conditionScore: 8,
      interiorModernity: 7,
      curbAppeal: 9,
      qualityTier: 'Premium',
      highlights: ['Beach outlook'],
      redFlags: [],
      reasoning: 'Bright.',
      confidence: 0.81,
    },
    vision_status: 'complete',
    vision_analyzed_at: null,
    vision_model: 'placeholder-seed',
    vision_schema_version: 1,
    vision_photos_hash: 'x',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const booking: Booking = {
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
  currency: 'AUD',
  status: 'confirmed',
  stripe_payment_intent_id: 'pi_secret',
  cancellation_policy_key: 'moderate',
  cancellation_policy_version: 1,
  cancellation_policy_snapshot: {},
  cancelled_at: null,
  cancelled_by: null,
  refund_amount_minor: null,
  guest_preferences: {},
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

const payout: Payout = {
  id: 'pay1',
  booking_id: 'b1',
  owner_id: 'o1',
  host_id: null,
  settlement_base_minor: 111000,
  owner_amount_minor: 107670,
  host_amount_minor: 0,
  platform_amount_minor: 3330,
  owner_pct_snapshot: 97,
  host_pct_snapshot: 0,
  platform_pct_snapshot: 3,
  currency: 'AUD',
  status: 'held',
  releasable_at: '2031-08-05T00:00:00.000Z',
  stripe_transfer_owner_id: 'tr_secret',
  stripe_transfer_host_id: null,
  failure_reason: null,
  released_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
};

describe('MCP response shapes', () => {
  it('exposes the useful fields and drops internal ones', () => {
    const dto = toPropertyDto(property());
    expect(dto.city).toBe('Sydney');
    expect(dto.price.baseMinor).toBe(34000);
    expect(dto.vision?.qualityTier).toBe('Premium');

    const serialized = JSON.stringify(dto);
    // Storage paths and model hashes are not part of the external shape.
    expect(serialized).not.toContain('cover.jpg');
    expect(serialized).not.toContain('vision_photos_hash');
  });

  it('omits vision when analysis is not complete', () => {
    expect(toPropertyDto(property({ vision_status: 'pending' })).vision).toBeNull();
  });

  it('never leaks payment identifiers or guest identity', () => {
    const dto = toBookingDto(booking, 'Bondi Beachfront Flat');
    const serialized = JSON.stringify(dto);

    expect(dto.paid).toBe(true);
    expect(dto.amounts.totalMinor).toBe(111000);
    expect(dto.propertyTitle).toBe('Bondi Beachfront Flat');
    expect(serialized).not.toContain('pi_secret');
    expect(serialized).not.toContain('g1');
  });

  it('never leaks transfer identifiers in payouts', () => {
    const serialized = JSON.stringify(toPayoutDto(payout));
    expect(serialized).not.toContain('tr_secret');
    expect(serialized).toContain('held');
  });
});
