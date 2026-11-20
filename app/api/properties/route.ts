import { NextResponse, after } from 'next/server';
import { requireRole, errorResponse, HttpError } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { createPropertyInputSchema } from '@/app/lib/ai/schemas';
import { SupabasePropertyGateway } from '@/infrastructure/db/property.gateway';
import { SupabaseProfileGateway } from '@/infrastructure/db/profile.gateway';
import { CreatePropertyUseCase } from '@/app/core/usecases/create-property.use';
import { AnalyzePropertyUseCase } from '@/app/core/usecases/analyze-property.use';
import { createAiAdapter } from '@/infrastructure/ai/openrouter.adapter';
import { createSignedUrlResolver } from '@/app/lib/storage/signed-urls';

/** GET /api/properties — the signed-in owner's properties. */
export async function GET() {
  try {
    const { supabase, user, profile } = await requireRole(['owner', 'admin']);

    const gateway = new SupabasePropertyGateway(supabase);
    const properties = await gateway.listByOwner(user.id);

    return NextResponse.json({ properties, role: profile.role });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * POST /api/properties — create a draft property.
 *
 * The vision analysis is queued with `after()` so it runs once the response
 * has been sent. A slow or failing model never blocks the save (spec §1).
 */
export async function POST(request: Request) {
  try {
    const { supabase, user } = await requireRole(['owner', 'admin']);

    await enforceRateLimit(supabase, `property:create:${user.id}`, RATE_LIMITS.propertyCreate);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'Request body must be JSON');
    }

    const parsed = createPropertyInputSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid property data',
          issues: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.') || '<root>',
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const input = parsed.data;

    const propertyGateway = new SupabasePropertyGateway(supabase);
    const profileGateway = new SupabaseProfileGateway(supabase);
    const useCase = new CreatePropertyUseCase(propertyGateway, profileGateway);

    const { property } = await useCase.execute({
      ...input,
      minPriceMinor: input.minPriceMinor ?? input.basePriceMinor,
      maxPriceMinor: input.maxPriceMinor ?? input.basePriceMinor,
      ownerId: user.id,
    });

    const aiPort = createAiAdapter();
    const shouldAnalyze = property.photos.length > 0 && aiPort.isConfigured();

    if (shouldAnalyze) {
      after(async () => {
        try {
          const analyzeUseCase = new AnalyzePropertyUseCase(
            propertyGateway,
            aiPort,
            createSignedUrlResolver(supabase),
          );
          await analyzeUseCase.execute({ propertyId: property.id });
        } catch (error) {
          // Vision failure is recorded on the property by the use case; it must
          // never surface as a failed save.
          console.error(`Background vision analysis failed for ${property.id}:`, error);
        }
      });
    }

    return NextResponse.json(
      {
        property,
        vision: shouldAnalyze
          ? { queued: true }
          : {
              queued: false,
              reason:
                property.photos.length === 0
                  ? 'No photos to analyse yet'
                  : 'AI provider is not configured',
            },
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
