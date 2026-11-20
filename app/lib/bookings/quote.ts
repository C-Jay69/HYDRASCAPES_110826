/**
 * Booking quote (spec §15, §30).
 *
 * All arithmetic happens in integer minor units in TypeScript. No model, no
 * floating point, one place that decides what a stay costs.
 *
 * For now the nightly rate is the property's base price; the full
 * seasonality/occupancy pricing engine is Phase 5 and will feed
 * `perNightRateMinor` without changing this module's contract.
 */

export class QuoteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuoteError';
  }
}

export interface QuoteInput {
  basePriceMinor: number;
  cleaningFeeMinor: number;
  currency: string;
  checkin: string;
  checkout: string;
  guestsCount: number;
  maxGuests: number;
}

export interface Quote {
  nights: number;
  perNightRateMinor: number;
  nightlySubtotalMinor: number;
  cleaningFeeMinor: number;
  taxesMinor: number;
  totalMinor: number;
  currency: string;
}

const MAX_NIGHTS = 365;
const DAY_MS = 86_400_000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Parses `YYYY-MM-DD` as UTC midnight, rejecting impossible dates. */
export function parseDateOnly(value: string): Date {
  if (!DATE_RE.test(value)) throw new QuoteError(`Invalid date "${value}"; expected YYYY-MM-DD`);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new QuoteError(`Invalid calendar date "${value}"`);
  }
  return date;
}

export function nightsBetween(checkin: string, checkout: string): number {
  const start = parseDateOnly(checkin);
  const end = parseDateOnly(checkout);
  const nights = Math.round((end.getTime() - start.getTime()) / DAY_MS);
  if (nights <= 0) throw new QuoteError('Checkout must be after check-in');
  return nights;
}

export function buildQuote(input: QuoteInput): Quote {
  const basePrice = Math.trunc(input.basePriceMinor);
  const cleaningFee = Math.trunc(input.cleaningFeeMinor);

  if (!Number.isSafeInteger(basePrice) || basePrice <= 0) {
    throw new QuoteError('Property has no valid nightly price');
  }
  if (!Number.isSafeInteger(cleaningFee) || cleaningFee < 0) {
    throw new QuoteError('Property has an invalid cleaning fee');
  }
  if (!Number.isInteger(input.guestsCount) || input.guestsCount < 1) {
    throw new QuoteError('At least one guest is required');
  }
  if (input.guestsCount > input.maxGuests) {
    throw new QuoteError(`This property sleeps at most ${input.maxGuests} guests`);
  }

  const nights = nightsBetween(input.checkin, input.checkout);
  if (nights > MAX_NIGHTS) {
    throw new QuoteError(`Stays are limited to ${MAX_NIGHTS} nights`);
  }

  const nightlySubtotal = basePrice * nights;
  if (!Number.isSafeInteger(nightlySubtotal)) {
    throw new QuoteError('Stay total is too large');
  }

  return {
    nights,
    perNightRateMinor: basePrice,
    nightlySubtotalMinor: nightlySubtotal,
    cleaningFeeMinor: cleaningFee,
    // No tax model yet; kept explicit so it is impossible to forget later.
    taxesMinor: 0,
    totalMinor: nightlySubtotal + cleaningFee,
    currency: input.currency.toUpperCase(),
  };
}
