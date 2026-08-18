import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/service';
import { invariant } from '@s/std';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

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

    // Generate a new UUID for the property ID
    // Note: This uses a lightweight UUID implementation compatible with Edge Runtime
    const propertyId = crypto.randomUUID();

    // Insert property with pending vision status
    const { data: property, error } = await supabase
      .from('properties')
      .insert({
        id: propertyId,
        owner_id: user.id,
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
        status: 'draft', // Start as draft, will be listed after AI analysis
        photos,
        cover_photo,
        vision_status: 'pending', // AI analysis not started yet
        vision_analysis: {}, // Empty initially
      })
      .select()
      .single();

    if (error) {
      console.error('Property insertion error:', error);
      return NextResponse.json(
        { error: 'Failed to create property' },
        { status: 500 }
      );
    }

    // Trigger AI analysis in background (do not wait for response)
    // We'll call an internal API route to process the analysis
    const analyzeUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/properties/${property.id}/analyze`;

    // Fire and forget - we don't await this
    fetch(analyzeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ propertyId: property.id }),
    }).catch((err) => {
      console.error('Background AI analysis trigger failed:', err);
    });

    // Return the created property immediately
    return NextResponse.json({ property }, { status: 201 });
  } catch (error) {
    console.error('Property creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}