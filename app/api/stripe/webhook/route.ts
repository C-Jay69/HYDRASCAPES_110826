/**
 * Deprecated alias.
 *
 * The specification (§18) names this endpoint `/api/webhooks/stripe`. This
 * path is kept so an already-configured Stripe endpoint keeps working.
 */

export { POST, dynamic } from '@/app/api/webhooks/stripe/route';
