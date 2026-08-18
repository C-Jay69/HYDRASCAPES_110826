/**
 * OpenRouter AI Vision Analysis Endpoint
 * Analyzes property photos using OpenRouter's unified API with multimodal models.
 *
 * Replaces placeholder endpoint with actual AI analysis integration.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/app/lib/supabase/client';
import { analyzePropertyPhotos, VisionAnalysisResponse } from '@/app/lib/ai/openrouter';
import { invariant } from '@s/std';
import { getSupabasePublicUrl } from '@/app/lib/ai/openrouter';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const body = await request.json();

    // Extract the property ID from the request body
    const propertyId = invariant(body.propertyId, 'Property ID is required');

    // Fetch property details including photo paths
    const { data: property, error: propError } = await supabase
      .from('properties')
      .select('id, title, photos, cover_photo, vision_status')
      .eq('id', propertyId)
      .single();

    if (propError) {
      console.error('Property fetch error:', propError);
      return NextResponse.json(
        { error: 'Failed to fetch property' },
        { status: 500 }
      );
    }

    if (!property) {
      return NextResponse.json(
        { error: 'Property not found' },
        { status: 404 }
      );
    }

    // Get the photo paths - ensure they're public URLs
    const photoPaths = Array.isArray(property.photos) ? property.photos : [];
    const imageUrls = photoPaths.map((path) => getSupabasePublicUrl('property-photos', path));

    // Add cover photo if it's different from the photos array
    if (property.cover_photo && !imageUrls.includes(property.cover_photo)) {
      imageUrls.unshift(getSupabasePublicUrl('property-photos', property.cover_photo));
    }

    if (imageUrls.length === 0) {
      return NextResponse.json(
        { error: 'No property photos found for analysis' },
        { status: 400 }
      );
    }

    // Maximum images to analyze (configurable)
    const MAX_IMAGES = 6;
    const imagesToAnalyze = imageUrls.slice(0, MAX_IMAGES);

    console.log(`Analyzing ${imagesToAnalyze.length} property photos (property: ${propertyId})`);

    // Perform AI vision analysis
    const analysis: VisionAnalysisResponse = await analyzePropertyPhotos(imagesToAnalyze);

    // Update property record with analysis results
    const { error: updateError } = await supabase
      .from('properties')
      .update({
        vision_status: 'completed' as const,
        vision_analysis: {
          condition_score: analysis.conditionScore,
          interior_modernity: analysis.interiorModernity,
          curb_appeal: analysis.curbAppeal,
          quality_tier: analysis.qualityTier,
          highlights: analysis.highlights,
          red_flags: analysis.redFlags,
          reasoning: analysis.reasoning,
          confidence: analysis.confidence,
          model: process.env.AI_MODEL || 'openrouter',
          analyzed_at: new Date().toISOString(),
        },
        // Also update base price with AI-adjusted pricing
        base_price_minor: Math.round(
          (property.base_price_minor ?? 0) *
          (1 + (analysis.conditionScore / 10) * 0.15) // AI adjustment: +15% per condition point
        ),
        updated_at: new Date().toISOString(),
      })
      .eq('id', propertyId);

    if (updateError) {
      console.error('Property update error:', updateError);
      return NextResponse.json(
        { error: 'Failed to update property with analysis' },
        { status: 500 }
      );
    }

    // Return the analysis results to the caller
    return NextResponse.json(
      {
        message: 'AI analysis completed successfully',
        propertyId,
        analysis: {
          conditionScore: analysis.conditionScore,
          interiorModernity: analysis.interiorModernity,
          curbAppeal: analysis.curbAppeal,
          qualityTier: analysis.qualityTier,
          highlights: analysis.highlights,
          redFlags: analysis.redFlags,
          confidence: analysis.confidence,
        },
        updatedProperty: {
          id: property.id,
          title: property.title,
          basePriceMinor: property.base_price_minor,
          visionStatus: 'completed',
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
    }

    return NextResponse.json(
      { error: 'AI analysis failed. Please try again.' },
      { status: 500 }
    );
  }
}