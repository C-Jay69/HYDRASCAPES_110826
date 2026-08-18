// app/api/stripe/webhook/route.ts
// Edge API route to handle Stripe webhook events with idempotent handling.
// It verifies the Stripe signature, checks if the event has already been processed,
// and if not, processes the event and marks it as processed.

import { NextResponse } from 'next/server';
import { supabase } from '@/app/lib/supabaseClient';
import Stripe from 'stripe';

// Initialize Stripe with the secret key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-18',
});

/**
 * Helper to check if an event has already been processed.
 * Returns true if the event ID exists in the processed_webhook_events table.
 */
async function isEventProcessed(eventId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('processed_webhook_events')
    .select('id')
    .eq('event_id', eventId)
    .single();

  if (error && error.error !== 'empty') {
    // Log the error but don't fail the request; we just treat it as not processed
    console.error('Supabase query error:', error);
  }

  return !!data;
}

/**
 * Helper to store a processed event ID.
 * This ensures idempotent handling of webhook events.
 */
async function markEventProcessed(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('processed_webhook_events')
    .upsert({ event_id: eventId }, { upsert: true });

  if (error) {
    console.error('Failed to mark webhook event as processed:', error);
  }
}

/**
 * Handler for Stripe webhook events.
 * This function is invoked by Stripe when a webhook event occurs.
 * It processes the event only once (idempotent) and stores the processed event ID.
 */
export async function POST(request: Request) {
  // Extract the raw body as a string (required for signature verification)
  const body = await request.text();

  // Extract the signature header
  const signature = request.headers.get('Stripe-Signature');

  // Parse the JSON payload (Stripe sends JSON)
  const payload = JSON.parse(body);

  // Determine the type of event (e.g., 'checkout.session.completed')
  const event = payload; // payload is assumed to be the parsed JSON event object

  // Attempt to process the webhook event
  try {
    // Verify the signature using the Stripe signature secret
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = stripe.webhooks.constructEvent(body, signature, secret);

    // Check if this event has already been processed (idempotent handling)
    const alreadyProcessed = await isEventProcessed(event.id);

    if (alreadyProcessed) {
      console.log(`Webhook event ${event.id} already processed, skipping.`);
      return new NextResponse(null, { status: 200 });
    }

    // Process the event according to its type
    switch (event.type) {
      case 'customer.subscription.created':
        // Handle subscription creation (e.g., send welcome email)
        console.log('Subscription created:', event.data.object.id);
        // Additional processing logic can be added here.
        break;

      case 'customer.subscription.updated':
        // Handle subscription update
        console.log('Subscription updated:', event.data.object.id);
        break;

      case 'customer.subscription.deleted':
        // Handle subscription cancellation
        console.log('Subscription deleted:', event.data.object.id);
        break;

      case 'payment_intent.succeeded':
        // Handle successful payment
        console.log('Payment succeeded:', event.data.object.id);
        break;

      // Add other event types as needed
      default:
        console.log(`Unhandled event type: ${event.type}`);
        break;
    }

    // After successful processing, mark the event as processed
    await markEventProcessed(event.id);

    // Return a 200 response to acknowledge receipt
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new NextResponse('Webhook processing error', {
      status: 400,
    });
  }
}