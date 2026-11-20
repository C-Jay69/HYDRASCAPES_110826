/**
 * Money helpers (spec §30 financial invariants).
 *
 * Every persisted monetary value is an integer number of minor units, e.g.
 * USD 123.45 -> 12345. Floating point never touches stored money. These
 * helpers are the only sanctioned conversion boundary between user input,
 * display strings and persisted integers.
 */

/** Currencies with no decimal minor unit. */
const ZERO_DECIMAL_CURRENCIES = new Set(['JPY', 'KRW', 'VND', 'CLP', 'ISK', 'XOF', 'XAF']);

/** Currencies whose minor unit is 1/1000. */
const THREE_DECIMAL_CURRENCIES = new Set(['BHD', 'JOD', 'KWD', 'OMR', 'TND']);

export function minorUnitDigits(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL_CURRENCIES.has(code)) return 0;
  if (THREE_DECIMAL_CURRENCIES.has(code)) return 3;
  return 2;
}

/** Throws when a value is not safe integer minor units. */
export function assertIntegerMinor(amount: number, label = 'amount'): void {
  if (!Number.isSafeInteger(amount)) {
    throw new Error(`${label} must be a safe integer in minor units, received ${amount}`);
  }
}

/**
 * Parses user input ("150", "150.5", 150.5) into integer minor units.
 * Returns null for anything that is not a finite, non-negative amount with
 * at most the currency's allowed decimal places.
 */
export function parseAmountToMinor(
  input: string | number,
  currency: string,
): number | null {
  const raw = typeof input === 'number' ? String(input) : input.trim();
  if (!/^\d+(\.\d+)?$/.test(raw)) return null;

  const digits = minorUnitDigits(currency);
  const [whole, fraction = ''] = raw.split('.');
  if (fraction.length > digits) return null;

  const paddedFraction = fraction.padEnd(digits, '0');
  const minor = Number(`${whole}${paddedFraction}`);
  return Number.isSafeInteger(minor) ? minor : null;
}

/** Formats integer minor units for display, e.g. 12345 -> "123.45". */
export function formatMinor(amountMinor: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  const sign = amountMinor < 0 ? '-' : '';
  const absolute = Math.abs(Math.trunc(amountMinor));
  if (digits === 0) return `${sign}${absolute}`;

  const divisor = 10 ** digits;
  const whole = Math.floor(absolute / divisor);
  const fraction = String(absolute % divisor).padStart(digits, '0');
  return `${sign}${whole}.${fraction}`;
}

/** Locale-aware display string, e.g. 12345 USD -> "$123.45". */
export function formatCurrency(amountMinor: number, currency: string, locale = 'en-US'): string {
  const digits = minorUnitDigits(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency.toUpperCase(),
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(amountMinor / 10 ** digits);
  } catch {
    return `${formatMinor(amountMinor, currency)} ${currency.toUpperCase()}`;
  }
}
