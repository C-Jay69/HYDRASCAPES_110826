import { NextResponse } from 'next/server';
import { requireUser, errorResponse, HttpError } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { SupabasePropertyGateway } from '@/infrastructure/db/property.gateway';
import { AnalyzePropertyUseCase } from '@/app/core/usecases/analyze-property.use';
import { createAiAdapter } from '@/infrastructure/ai/openrouter.adapter';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';

/**
 * POST /api/properties/[id]/analyze-vision
 *
 * Re-runs vision analysis on demand. Owner (or admin) only, and rate limited:
 * every run costs inference tokens (spec §20, §21).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, user, profile } = await requireUser();

    await enforceRateLimit(supabase, `ai:vision:${user.id}`, RATE_LIMITS.aiVision);

    const propertyGateway = new SupabasePropertyGateway(supabase);
    const property = await propertyGateway.getById(id);

    if (!property) throw new HttpError(404, 'Property not found');
    if (property.owner_id !== user.id && profile.role !== 'admin') {
      throw new HttpError(403, 'You do not have permission to analyse this property');
    }

    const aiPort = createAiAdapter();
    if (!aiPort.isConfigured()) {
      return NextResponse.json(
        { error: 'AI provider is not configured', code: 'ai_unconfigured' },
        { status: 503 },
      );
    }

    const useCase = new AnalyzePropertyUseCase(
      propertyGateway,
      aiPort,
      createSignedUrlResolver(supabase),
    );

    const result = await useCase.execute({ propertyId: id, force: true });

    return NextResponse.json({
      propertyId: id,
      skipped: result.skipped,
      analysis: result.analysis,
      pricing: {
        basePriceMinor: result.property.basePriceMinor,
        suggestedPriceMinor: result.property.suggestedPriceMinor,
        currency: result.property.currency,
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'Property not found') {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
      if (error.message.includes('No property photos')) {
        return NextResponse.json(
          { error: 'No property photos found for analysis' },
          { status: 400 },
        );
      }
      if (error.message.includes('validated')) {
        return NextResponse.json(
          { error: 'AI returned an invalid analysis; nothing was stored', code: 'ai_invalid' },
          { status: 502 },
        );
      }
    }
    return errorResponse(error);
  }
}
