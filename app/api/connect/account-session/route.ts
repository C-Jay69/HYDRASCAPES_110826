import { NextResponse } from 'next/server';
import { requireRole, errorResponse, HttpError } from '@/app/lib/authorization';
import { createServiceClient } from '@/app/lib/supabase/service';
import {
  createStripeAdapter,
  stripeIsConfigured,
} from '@/infrastructure/payments/stripe.adapter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/connect/account-session
 *
 * Client secret for Connect.js embedded components (onboarding + notification
 * banner). The secret is per-request and short-lived; it is returned only to
 * the account's own authenticated user.
 */
export async function POST() {
  try {
    const { profile } = await requireRole(['owner', 'host', 'admin']);

    if (!stripeIsConfigured()) {
      throw new HttpError(503, 'Payments are not configured');
    }
    if (!profile.stripe_connect_id) {
      throw new HttpError(400, 'Set up a payout account first');
    }

    const adapter = createStripeAdapter(createServiceClient());
    const session = await adapter.createAccountSession(profile.stripe_connect_id);

    return NextResponse.json(
      { clientSecret: session.clientSecret },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
