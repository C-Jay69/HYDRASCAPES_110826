/**
 * How long an unpaid booking holds its dates (Stripe plan review, finding #1).
 *
 * The hold must outlive the Checkout Session, never the other way round: if a
 * session stays payable after the dates were released, a guest can pay for a
 * booking that has already been cancelled. Stripe requires a session lifetime
 * of at least 30 minutes, so the hold is deliberately longer.
 */

/** Session lifetime we request from Stripe. Stripe's minimum is 30 minutes. */
export const CHECKOUT_SESSION_MINUTES = 30;

/** Hold lifetime. Must be strictly greater than the session lifetime. */
export const HOLD_MINUTES = 40;

/** Unix seconds at which a session created now should expire. */
export function checkoutExpiresAt(now: Date = new Date()): number {
  return Math.floor(now.getTime() / 1000) + CHECKOUT_SESSION_MINUTES * 60;
}

/** True when the configured constants still guarantee hold > session. */
export function holdOutlivesSession(): boolean {
  return HOLD_MINUTES > CHECKOUT_SESSION_MINUTES;
}
