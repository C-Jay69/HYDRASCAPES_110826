/**
 * Stripe adapter (spec §15, §16).
 *
 * Responsibilities: signature verification, idempotency bookkeeping, and
 * dispatch by event type. Financial effects belong to the application layer;
 * this module never computes an amount.
 */

import Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

/** Only provider handled here. The column exists so others can be added. */
const PROVIDER = 'stripe';
/** Postgres unique-violation error code. */
const UNIQUE_VIOLATION = '23505';

export interface BeginEventInput {
  id: string;
  type: string;
  payloadHash: string;
}

export interface StripePort {
  verifyWebhookSignature: (
    body: string,
    signature: string,
    webhookSecret: string,
  ) => Stripe.Event;
  /**
   * Claims the event for processing. Returns false when this
   * (provider, event_id) pair was already claimed — a duplicate delivery.
   * Backed by the table's unique constraint, so it is race-safe.
   */
  beginEvent: (event: BeginEventInput) => Promise<boolean>;
  markEventProcessed: (eventId: string) => Promise<void>;
  markEventFailed: (eventId: string, errorCode: string) => Promise<void>;
  /** Applies the event. Must be idempotent on its own as well. */
  handleEvent: (event: Stripe.Event) => Promise<void>;
}

export function createStripeAdapter(supabase: SupabaseClient): StripePort {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }
  const stripe = new Stripe(secretKey);

  const events = () => supabase.from('processed_webhook_events');

  return {
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

      // Anything else is a real failure: surface it so the caller returns 5xx
      // and Stripe retries, rather than silently dropping the event.
      throw new Error(`Failed to record webhook event ${event.id}: ${error.message}`);
    },

    async markEventProcessed(eventId) {
      const { error } = await events()
        .update({ processing_status: 'processed', processed_at: new Date().toISOString() })
        .eq('provider', PROVIDER)
        .eq('event_id', eventId);

      if (error) {
        console.error(`Failed to mark webhook event ${eventId} processed:`, error);
      }
    },

    async markEventFailed(eventId, errorCode) {
      const { error } = await events()
        .update({ processing_status: 'failed', error_code: errorCode.slice(0, 200) })
        .eq('provider', PROVIDER)
        .eq('event_id', eventId);

      if (error) {
        console.error(`Failed to mark webhook event ${eventId} failed:`, error);
      }
    },

    async handleEvent(event) {
      // Event handlers are added per build phase. Until a handler exists the
      // event is acknowledged and recorded, never partially applied.
      switch (event.type) {
        case 'payment_intent.succeeded':
        case 'payment_intent.payment_failed':
        case 'charge.refunded':
        case 'transfer.created':
        case 'payout.paid':
        case 'account.updated':
          console.log(`Stripe event ${event.id} (${event.type}) recorded`);
          break;
        default:
          console.log(`Unhandled Stripe event type: ${event.type}`);
          break;
      }
    },
  };
}
