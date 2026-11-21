import { NextResponse } from 'next/server';
import { requireRole, errorResponse } from '@/app/lib/authorization';
import { createServiceClient } from '@/app/lib/supabase/service';
import { SupabaseProfileGateway } from '@/infrastructure/db/profile.gateway';
import { ConnectOnboardingUseCase } from '@/app/core/usecases/connect-onboarding.use';
import {
  createStripeAdapter,
  stripeIsConfigured,
} from '@/infrastructure/payments/stripe.adapter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/connect/onboard
 *
 * Returns a Stripe onboarding URL for the signed-in owner/host. The account is
 * created once and its id stored on the profile; links are re-issued on every
 * call because they expire.
 */
export async function POST(request: Request) {
  try {
    const { user, profile } = await requireRole(['owner', 'host', 'admin']);

    const body = (await request.json().catch(() => ({}))) as { country?: unknown };
    const country = typeof body.country === 'string' ? body.country : undefined;

    if (!stripeIsConfigured()) {
      return NextResponse.json(
        { error: 'Stripe is not configured; payouts cannot be set up yet', code: 'payments_unavailable' },
        { status: 503 },
      );
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const returnTo = `${appUrl}/dashboard/${profile.role}/payouts?connect=return`;

    const service = createServiceClient();
    const useCase = new ConnectOnboardingUseCase(
      new SupabaseProfileGateway(service),
      createStripeAdapter(service),
    );

    const result = await useCase.execute({
      profileId: user.id,
      returnUrl: returnTo,
      refreshUrl: `${returnTo}&refresh=1`,
      country,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
