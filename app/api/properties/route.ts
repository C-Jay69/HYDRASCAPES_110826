import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/service';
import { createOpenRouterAdapter } from '@/infrastructure/ai/openrouter.adapter';
import { createSupabasePropertyGateway } from '@/infrastructure/db/property.gateway';
import { createSupabaseProfileGateway } from '@/infrastructure/db/profile.gateway';
import { CreatePropertyUseCase } from '@/app/core/usecases/create-property.use';
import { AnalyzePropertyUseCase } from '@/app/core/usecases/analyze-property.use';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // Initialize gateways and use cases
    const propertyGateway = new createSupabasePropertyGateway(supabase);
    const profileGateway = new createSupabaseProfileGateway(supabase);
    const aiPort = createOpenRouterAdapter();

    const createUseCase = new CreatePropertyUseCase(
      propertyGateway,
      profileGateway,
      aiPort
    );

    const analyzeUseCase = new AnalyzePropertyUseCase(
      propertyGateway,
      aiPort
    );

    // Extract property data from request
    const {
      title,
      description,
      address_json,
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      max_guests,
      amenities,
      base_price_minor,
      min_price_minor,
      max_price_minor,
      currency,
      cleaning_fee_minor,
      photos, // array of storage paths
      cover_photo,
    } = body;

    // Validate required fields
    if (!title || !address_json || !photos || photos.length === 0) {
      return NextResponse.json(
        { error: 'Title, address, and at least one photo are required' },
        { status: 400 }
      );
    }

    // Get the current user (owner) from auth
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create property
    const createResult = await createUseCase.execute({
      title,
      description,
      address_json,
      latitude,
      longitude,
      bedrooms,
      bathrooms,
      max_guests,
      amenities,
      base_price_minor,
      min_price_minor,
      max_price_minor,
      currency,
      cleaning_fee_minor,
      photos,
      cover_photo,
      ownerId: user.id,
    });

    // Trigger AI analysis in background
    const analyzeResult = await analyzeUseCase.execute({
      propertyId: createResult.property.id,
    });

    // Return the created property with analysis results
    return NextResponse.json(
      {
        property: createResult.property,
        analysis: analyzeResult.analysis,
        message: 'Property created and AI analysis triggered',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Property creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}