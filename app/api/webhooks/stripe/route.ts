import { NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { createStripeAdapter } from '@/infrastructure/payments/stripe.adapter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe (spec §16)
 *
 * - The raw body is needed for signature verification, so it is read as text.
 * - The signature is verified before the payload is trusted at all.
 * - The event is claimed in `processed_webhook_events` before it is applied;
 *   a duplicate delivery returns 200 without re-applying the effect.
 * - Handler failures return 5xx so Stripe retries.
 */
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error('STRIPE_WEBHOOK_SECRET is not configured; rejecting webhook');
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Missing Stripe-Signature header' }, { status: 400 });
  }

  const body = await request.text();

  let adapter;
  try {
    adapter = createStripeAdapter(createServiceClient());
  } catch (error) {
    console.error('Stripe adapter unavailable:', error);
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 });
  }

  let event;
  try {
    event = adapter.verifyWebhookSignature(body, signature, secret);
  } catch (error) {
    // Invalid signature is a 400, per Stripe's own guidance.
    console.error('Stripe signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Record first, apply second: the unique (provider, event_id) constraint is
  // what makes duplicate delivery safe.
  const payloadHash = await sha256Hex(body);
  const isNew = await adapter.beginEvent({
    id: event.id,
    type: event.type,
    payloadHash,
  });

  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    await adapter.handleEvent(event);
    await adapter.markEventProcessed(event.id);
    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error(`Stripe event ${event.id} (${event.type}) failed:`, error);
    await adapter.markEventFailed(
      event.id,
      error instanceof Error ? error.message : 'handler_failed',
    );
    return NextResponse.json({ error: 'Event processing failed' }, { status: 500 });
  }
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}
