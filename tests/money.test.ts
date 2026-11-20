import { describe, it, expect } from 'vitest';
import {
  parseAmountToMinor,
  formatMinor,
  formatCurrency,
  minorUnitDigits,
  assertIntegerMinor,
} from '../app/lib/money';

describe('minorUnitDigits', () => {
  it('uses 2 decimals for most currencies', () => {
    expect(minorUnitDigits('USD')).toBe(2);
    expect(minorUnitDigits('gbp')).toBe(2);
  });

  it('knows zero-decimal and three-decimal currencies', () => {
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(minorUnitDigits('KWD')).toBe(3);
  });
});

describe('parseAmountToMinor', () => {
  it('parses plain and decimal amounts', () => {
    expect(parseAmountToMinor('150', 'USD')).toBe(15000);
    expect(parseAmountToMinor('150.5', 'USD')).toBe(15050);
    expect(parseAmountToMinor('0.01', 'USD')).toBe(1);
    expect(parseAmountToMinor(99.99, 'USD')).toBe(9999);
  });

  it('rejects more decimals than the currency allows', () => {
    expect(parseAmountToMinor('10.001', 'USD')).toBeNull();
    expect(parseAmountToMinor('10.5', 'JPY')).toBeNull();
  });

  it('rejects negatives, exponents and junk', () => {
    expect(parseAmountToMinor('-5', 'USD')).toBeNull();
    expect(parseAmountToMinor('1e3', 'USD')).toBeNull();
    expect(parseAmountToMinor('12,50', 'USD')).toBeNull();
    expect(parseAmountToMinor('', 'USD')).toBeNull();
    expect(parseAmountToMinor('abc', 'USD')).toBeNull();
  });

  it('handles zero-decimal currencies', () => {
    expect(parseAmountToMinor('1500', 'JPY')).toBe(1500);
  });
});

describe('formatMinor', () => {
  it('round-trips with parseAmountToMinor', () => {
    for (const amount of ['0.01', '1', '150', '150.5', '99999.99']) {
      const minor = parseAmountToMinor(amount, 'USD')!;
      expect(parseAmountToMinor(formatMinor(minor, 'USD'), 'USD')).toBe(minor);
    }
  });

  it('pads fractions', () => {
    expect(formatMinor(5, 'USD')).toBe('0.05');
    expect(formatMinor(15000, 'USD')).toBe('150.00');
    expect(formatMinor(-15000, 'USD')).toBe('-150.00');
  });

  it('omits decimals for zero-decimal currencies', () => {
    expect(formatMinor(1500, 'JPY')).toBe('1500');
  });
});

describe('formatCurrency', () => {
  it('formats using Intl', () => {
    expect(formatCurrency(12345, 'USD', 'en-US')).toBe('$123.45');
  });

  it('falls back safely when Intl rejects the currency code', () => {
    // Two-letter code is a RangeError for Intl; the helper must not throw.
    expect(formatCurrency(12345, 'US', 'en-US')).toBe('123.45 US');
  });
});

describe('assertIntegerMinor', () => {
  it('accepts integers and rejects floats', () => {
    expect(() => assertIntegerMinor(100)).not.toThrow();
    expect(() => assertIntegerMinor(100.5)).toThrow(/minor units/);
    expect(() => assertIntegerMinor(Number.NaN)).toThrow();
  });
});
