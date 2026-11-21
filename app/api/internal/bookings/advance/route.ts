import { NextResponse } from 'next/server';
import { requireInternalToken } from '@/app/lib/internal-auth';
import { errorResponse } from '@/app/lib/http-error';
import { createServiceClient } from '@/app/lib/supabase/service';
import { SupabaseBookingGateway } from '@/infrastructure/db/booking.gateway';
import { AdvanceBookingsUseCase } from '@/app/core/usecases/advance-bookings.use';

export const dynamic = 'force-dynamic';

/**
 * POST /api/internal/bookings/advance
 *
 * Moves trips on by their dates: confirmed -> checked_in -> checked_out ->
 * completed. Idempotent, so it is safe to run on a schedule.
 */
export async function POST(request: Request) {
  try {
    requireInternalToken(request);

    const service = createServiceClient();
    const useCase = new AdvanceBookingsUseCase(new SupabaseBookingGateway(service));
    const result = await useCase.execute();

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
