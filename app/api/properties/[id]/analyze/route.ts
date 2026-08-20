import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/client';
import { createOpenRouterAdapter } from '@/infrastructure/ai/openrouter.adapter';
import { createSupabasePropertyGateway } from '@/infrastructure/db/property.gateway';
import { AnalyzePropertyUseCase } from '@/app/core/usecases/analyze-property.use';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // Initialize gateways and use cases
    const propertyGateway = new createSupabasePropertyGateway(supabase);
    const aiPort = createOpenRouterAdapter();

    const analyzeUseCase = new AnalyzePropertyUseCase(
      propertyGateway,
      aiPort
    );

    // Extract the property ID from the request body
    const propertyId = body.propertyId;

    if (!propertyId) {
      return NextResponse.json(
        { error: 'Property ID is required' },
        { status: 400 }
      );
    }

    // Execute analyze use case
    const result = await analyzeUseCase.execute({
      propertyId,
    });

    // Return the analysis results to the caller
    return NextResponse.json(
      {
        message: 'AI analysis completed successfully',
        propertyId,
        analysis: {
          conditionScore: result.analysis.conditionScore,
          interiorModernity: result.analysis.interiorModernity,
          curbAppeal: result.analysis.curbAppeal,
          qualityTier: result.analysis.qualityTier,
          highlights: result.analysis.highlights,
          redFlags: result.analysis.redFlags,
          confidence: result.analysis.confidence,
        },
        updatedProperty: {
          id: result.property.id,
          title: result.property.title,
          basePriceMinor: result.property.basePriceMinor,
          currency: result.property.currency,
          visionStatus: result.property.visionStatus,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('AI analysis error:', error);

    // Handle different error types gracefully
    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        return NextResponse.json(
          { error: 'AI analysis timed out. Please try again with fewer images.' },
          { status: 504 }
        );
      }
      if (error.message.includes('API key')) {
        return NextResponse.json(
          { error: 'AI service configuration error. Please contact support.' },
          { status: 500 }
        );
      }
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Property not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('No property photos')) {
        return NextResponse.json(
          { error: 'No property photos found for analysis' },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: 'AI analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}