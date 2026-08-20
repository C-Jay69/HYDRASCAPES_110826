/**
 * Stripe Adapter for Clean Architecture
 * adapts Stripe webhook handling to the core use case interfaces
 */

import type { Stripe } from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface StripePort {
  verifyWebhookSignature: (body: string, signature: string, webhookSecret: string) => Promise<Stripe.Event>;
  isEventProcessed: (eventId: string, supabase: SupabaseClient) => Promise<boolean>;
  markEventProcessed: (eventId: string, supabase: SupabaseClient) => Promise<void>;
  handleEvent: (event: Stripe.Event, supabase: SupabaseClient) => Promise<void>;
}

/**
 * Creates a Stripe port adapter.
 * The actual event processing logic is delegated to a handler function.
 */
export function createStripeAdapter(): StripePort {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2023-10-18',
  });

  return {
    verifyWebhookSignature: async (body: string, signature: string, webhookSecret: string) => {
      return stripe.webhooks.constructEvent(body, signature, webhookSecret);
    },
    isEventProcessed: async (eventId: string, supabase: SupabaseClient) => {
      const { data, error } = await supabase
        .from('processed_webhook_events')
        .select('id')
        .eq('event_id', eventId)
        .single();

      if (error && error.error !== 'empty') {
        console.error('Supabase query error checking webhook event:', error);
      }
      return !!data;
    },
    markEventProcessed: async (eventId: string, supabase: SupabaseClient) => {
      const { error } = await supabase
        .from('processed_webhook_events')
        .upsert({ event_id: eventId }, { upsert: true });

      if (error) {
        console.error('Failed to mark webhook event as processed:', error);
      }
    },
    handleEvent: async (event: Stripe.Event, supabase: SupabaseClient) => {
      // Process event by type - delegates to application logic
      switch (event.type) {
        case 'customer.subscription.created':
          console.log('Subscription created:', event.data.object.id);
          break;

        case 'customer.subscription.updated':
          console.log('Subscription updated:', event.data.object.id);
          break;

        case 'customer.subscription.deleted':
          console.log('Subscription deleted:', event.data.object.id);
          break;

        case 'payment_intent.succeeded':
          console.log('Payment succeeded:', event.data.object.id);
          break;

        default:
          console.log(`Unhandled event type: ${event.type}`);
          break;
      }
    },
  };
}