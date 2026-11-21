import { NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { createStripeAdapter } from '@/infrastructure/payments/stripe.adapter';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import { SupabasePayoutGateway } from '@/infrastructure/db/payout.gateway';
import { ConfirmBookingUseCase } from '@/app/core/usecases/confirm-booking.use';
import { ApplyStripeEventUseCase } from '@/app/core/usecases/apply-stripe-event.use';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe (spec §16)
 *
 * Order matters:
 *   1. verify the signature over the raw body,
 *   2. claim the event (unique provider+event_id) — duplicates stop here,
 *   3. apply it to booking state,
 *   4. mark it processed. Failures return 5xx so Stripe retries.
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

  const service = createServiceClient();

  let adapter;
  try {
    adapter = createStripeAdapter(service);
  } catch (error) {
    console.error('Stripe adapter unavailable:', error);
    return NextResponse.json({ error: 'Payments not configured' }, { status: 503 });
  }

  let event;
  try {
    event = adapter.verifyWebhookSignature(body, signature, secret);
  } catch (error) {
    console.error('Stripe signature verification failed:', error);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const isNew = await adapter.beginEvent({
    id: event.id,
    type: event.type,
    payloadHash: await sha256Hex(body),
  });

  if (!isNew) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  try {
    const bookingGateway = new SupabaseBookingGateway(service);
    const payoutGateway = new SupabasePayoutGateway(service);
    const apply = new ApplyStripeEventUseCase(
      bookingGateway,
      new ConfirmBookingUseCase(bookingGateway, payoutGateway),
      adapter,
      payoutGateway,
    );

    const result = await apply.execute({
      id: event.id,
      type: event.type,
      data: { object: event.data.object as unknown as Record<string, unknown> },
    });

    await adapter.markEventProcessed(event.id);
    return NextResponse.json({ received: true, ...result }, { status: 200 });
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
