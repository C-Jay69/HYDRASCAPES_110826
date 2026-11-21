import { NextResponse } from 'next/server';
import { requireInternalToken } from '@/app/lib/internal-auth';
import { errorResponse } from '@/app/lib/http-error';
import { createServiceClient } from '@/app/lib/supabase/service';
import { SupabasePayoutGateway } from '@/infrastructure/db/payout.gateway';
import { SupabaseProfileGateway } from '@/infrastructure/db/profile.gateway';
import {
  createStripeAdapter,
  stripeIsConfigured,
} from '@/infrastructure/payments/stripe.adapter';
import { ReleasePayoutsUseCase } from '@/app/core/usecases/release-payouts.use';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/payouts/release
 *
 * Pays out everything that is due. Safe to run repeatedly: transfers are keyed
 * per booking slot and reconciled against Stripe before retrying (spec §15.1).
 */
export async function POST(request: Request) {
  try {
    requireInternalToken(request);

    if (!stripeIsConfigured()) {
      return NextResponse.json(
        { error: 'Stripe is not configured; no transfers were attempted', code: 'payments_unavailable' },
        { status: 503 },
      );
    }

    const service = createServiceClient();
    const useCase = new ReleasePayoutsUseCase(
      new SupabasePayoutGateway(service),
      new SupabaseProfileGateway(service),
      createStripeAdapter(service),
    );

    const result = await useCase.execute();
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
