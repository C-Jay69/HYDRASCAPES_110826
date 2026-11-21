/**
 * Payee countries for Connect onboarding (Stripe plan review, finding #4).
 *
 * Self-serve cross-border payouts only work between the US, Canada, the UK and
 * the EEA/Switzerland. A Canadian platform cannot pay a recipient in Dubai or
 * Singapore through this flow, so onboarding is restricted to the corridor
 * rather than letting hosts start and fail later at payout time.
 *
 * Adding a country here is a product decision that requires checking Stripe's
 * current cross-border and verification requirements.
 */

export const PAYEE_COUNTRIES = [
  // North America
  { code: 'CA', name: 'Canada' },
  { code: 'US', name: 'United States' },
  // United Kingdom
  { code: 'GB', name: 'United Kingdom' },
  // EEA
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czechia' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  // Switzerland
  { code: 'CH', name: 'Switzerland' },
] as const;

const CODES = new Set(PAYEE_COUNTRIES.map((country) => country.code));

export function isSupportedPayeeCountry(code: string): boolean {
  return CODES.has(code.toUpperCase() as (typeof PAYEE_COUNTRIES)[number]['code']);
}
