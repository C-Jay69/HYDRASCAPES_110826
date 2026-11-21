/**
 * Payout currencies (Stripe plan review #7).
 *
 * Stripe converts between currencies when the platform's balance currency
 * differs from the connected account's — you do not convert amounts yourself.
 * What you must avoid is asking Stripe to transfer a currency it cannot move
 * from your balance, which fails the transfer (and Stripe does not retry).
 *
 * This list is deliberately broad: common presentment currencies we price
 * listings in. Anything outside it is skipped with a reason instead of being
 * sent and failing.
 */

export const SUPPORTED_TRANSFER_CURRENCIES = new Set([
  'USD', 'CAD', 'GBP', 'EUR', 'CHF',
  'SEK', 'DKK', 'NOK', 'PLN', 'CZK', 'HUF', 'RON', 'BGN',
  'AUD', 'NZD', 'JPY', 'SGD', 'HKD',
]);

export function isSupportedTransferCurrency(currency: string): boolean {
  return SUPPORTED_TRANSFER_CURRENCIES.has(currency.toUpperCase());
}

/** Local payout currency per payee country, for display and FX hints. */
const PAYEE_CURRENCY: Record<string, string> = {
  CA: 'CAD',
  US: 'USD',
  GB: 'GBP',
  CH: 'CHF',
  SE: 'SEK',
  DK: 'DKK',
  NO: 'NOK',
  PL: 'PLN',
  CZ: 'CZK',
  HU: 'HUF',
  RO: 'RON',
  BG: 'BGN',
  // Euro-area countries in the onboarding allow-list.
  AT: 'EUR', BE: 'EUR', HR: 'EUR', CY: 'EUR', EE: 'EUR', FI: 'EUR', FR: 'EUR',
  DE: 'EUR', GR: 'EUR', IE: 'EUR', IT: 'EUR', LV: 'EUR', LT: 'EUR', LU: 'EUR',
  MT: 'EUR', NL: 'EUR', PT: 'EUR', SK: 'EUR', SI: 'EUR', ES: 'EUR', IS: 'EUR',
  LI: 'CHF',
};

export function payeeCurrencyFor(country: string | null | undefined): string | null {
  if (!country) return null;
  return PAYEE_CURRENCY[country.toUpperCase()] ?? null;
}

/**
 * True when a Stripe transfer in `currency` to a payee in `country` will involve
 * an FX conversion (and therefore Stripe's FX fees).
 */
export function needsConversion(
  currency: string,
  country: string | null | undefined,
): boolean {
  const local = payeeCurrencyFor(country);
  if (!local) return false;
  return local !== currency.toUpperCase();
}
