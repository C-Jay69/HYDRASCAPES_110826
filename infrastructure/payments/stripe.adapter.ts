/**
 * Stripe adapter (spec §15, §16).
 *
 * Responsibilities: session/payment creation, refunds, signature verification
 * and webhook idempotency bookkeeping. No financial arithmetic lives here —
 * amounts arrive already computed in minor units by the booking modules.
 */

import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

const PROVIDER = 'stripe';
const UNIQUE_VIOLATION = '23505';

export interface BeginEventInput {
  id: string;
  type: string;
  payloadHash: string;
}

export interface CheckoutSessionInput {
  bookingId: string;
  amountMinor: number;
  currency: string;
  description: string;
  guestEmail?: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface StripePort {
  isConfigured: () => boolean;
  createCheckoutSession: (input: CheckoutSessionInput) => Promise<{ id: string; url: string | null }>;
  refund: (
    paymentIntentId: string,
    amountMinor: number,
    idempotencyKey: string,
  ) => Promise<{ id: string; status: string | null }>;
  verifyWebhookSignature: (
    body: string,
    signature: string,
    webhookSecret: string,
  ) => Stripe.Event;
  /** Claims the event for processing. False means a duplicate delivery. */
  beginEvent: (event: BeginEventInput) => Promise<boolean>;
  markEventProcessed: (eventId: string) => Promise<void>;
  markEventFailed: (eventId: string, errorCode: string) => Promise<void>;
}

export function stripeIsConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function createStripeAdapter(supabase: SupabaseClient): StripePort {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error('STRIPE_SECRET_KEY is not configured');
  const stripe = new Stripe(secretKey);

  const events = () => supabase.from('processed_webhook_events');

  return {
    isConfigured: () => true,

    async createCheckoutSession(input) {
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: input.currency.toLowerCase(),
                unit_amount: input.amountMinor,
                product_data: { name: input.description },
              },
            },
          ],
          customer_email: input.guestEmail ?? undefined,
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          // The booking id is the only trusted link back from the provider.
          metadata: { booking_id: input.bookingId },
          payment_intent_data: { metadata: { booking_id: input.bookingId } },
        },
        // One session per booking attempt; retries reuse the same intent key.
        { idempotencyKey: `checkout:${input.bookingId}` },
      );

      return { id: session.id, url: session.url };
    },

    async refund(paymentIntentId, amountMinor, idempotencyKey) {
      const refund = await stripe.refunds.create(
        { payment_intent: paymentIntentId, amount: amountMinor },
        { idempotencyKey },
      );
      return { id: refund.id, status: refund.status ?? null };
    },

    verifyWebhookSignature(body, signature, webhookSecret) {
      return stripe.webhooks.constructEvent(body, signature, webhookSecret);
    },

    async beginEvent(event) {
      const { error } = await events().insert({
        provider: PROVIDER,
        event_id: event.id,
        event_type: event.type,
        payload_hash: event.payloadHash,
        processing_status: 'processing',
      });

      if (!error) return true;
      if (error.code === UNIQUE_VIOLATION) return false;

      throw new Error(`Failed to record webhook event ${event.id}: ${error.message}`);
    },

    async markEventProcessed(eventId) {
      const { error } = await events()
        .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
        .eq('provider', PROVIDER)
        .eq('event_id', eventId);

      if (error) console.error(`Failed to mark webhook event ${eventId} processed:`, error);
    },

    async markEventFailed(eventId, errorCode) {
      const { error } = await events()
        .update({ processing_status: 'failed', error_code: errorCode.slice(0, 200) })
        .eq('provider', PROVIDER)
        .eq('event_id', eventId);

      if (error) console.error(`Failed to mark webhook event ${eventId} failed:`, error);
    },
  };
}
