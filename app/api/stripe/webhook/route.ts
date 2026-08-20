import { NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { createStripeAdapter } from '@/infrastructure/payments/stripe.adapter';

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const body = await request.text();
    const signature = request.headers.get('Stripe-Signature');

    const adapter = createStripeAdapter();

    // Verify the signature using the Stripe signature secret
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const event = await adapter.verifyWebhookSignature(body, signature, secret);

    // Check if this event has already been processed (idempotent handling)
    const alreadyProcessed = await adapter.isEventProcessed(event.id, supabase);

    if (alreadyProcessed) {
      console.log(`Webhook event ${event.id} already processed, skipping.`);
      return new NextResponse(null, { status: 200 });
    }

    // Process the event according to its type
    await adapter.handleEvent(event, supabase);

    // After successful processing, mark the event as processed
    await adapter.markEventProcessed(event.id, supabase);

    // Return a 200 response to acknowledge receipt
    return new NextResponse(null, { status: 200 });
  } catch (err) {
    console.error('Webhook processing error:', err);
    return new NextResponse('Webhook processing error', {
      status: 400,
    });
  }
}