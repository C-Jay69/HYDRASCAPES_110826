import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser, errorResponse, HttpError } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { createServiceClient } from '@/app/lib/supabase/service';
import { SupabasePropertyGateway } from '@/infrastructure/db/property.gateway';

export const dynamic = 'force-dynamic';

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must be YYYY-MM-DD')
  .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()), 'Invalid date');

const availabilitySchema = z.object({
  blocks: z
    .array(
      z
        .object({
          start: dateOnly,
          end: dateOnly,
          reason: z.string().trim().max(200).optional(),
        })
        .refine((block) => block.end > block.start, {
          message: 'End date must be after start date',
          path: ['end'],
        }),
    )
    .max(100, 'At most 100 blocked ranges at a time'),
});

/** Ensures the caller owns (or administers) the property. */
async function authorize(id: string) {
  const { supabase, user, profile } = await requireUser();
  const service = createServiceClient();
  const property = await new SupabasePropertyGateway(service).getById(id);

  if (!property) throw new HttpError(404, 'Property not found');
  if (property.owner_id !== user.id && profile.role !== 'admin') {
    throw new HttpError(403, 'You do not have permission to manage this property');
  }

  return { supabase, service, property };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { service } = await authorize(id);

    const { data, error } = await service
      .from('availability_blocks')
      .select('id, start_date, end_date, reason')
      .eq('property_id', id)
      .order('start_date');

    if (error) throw new HttpError(500, 'Could not load availability');

    return NextResponse.json({
      blocks: (data ?? []).map((row) => ({
        id: row.id as string,
        start: row.start_date as string,
        end: row.end_date as string,
        reason: (row.reason as string | null) ?? null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PUT /api/properties/[id]/availability
 *
 * Replaces the property's blocked ranges. Overlaps are rejected here *before*
 * anything is deleted, so a bad payload can never leave the owner with no
 * availability at all.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { supabase, service, property } = await authorize(id);

    await enforceRateLimit(supabase, `property:availability:${property.owner_id}`, RATE_LIMITS.propertyWrite);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      throw new HttpError(400, 'Request body must be JSON');
    }

    const parsed = availabilitySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Invalid availability data',
          issues: parsed.error.issues.map((issue) => ({
            field: issue.path.join('.') || '<root>',
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }

    const blocks = [...parsed.data.blocks].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < blocks.length; i += 1) {
      if (blocks[i].start < blocks[i - 1].end) {
        throw new HttpError(400, 'Blocked ranges must not overlap each other');
      }
    }

    const { error: deleteError } = await service
      .from('availability_blocks')
      .delete()
      .eq('property_id', id);

    if (deleteError) throw new HttpError(500, 'Could not update availability');

    if (blocks.length > 0) {
      const { error: insertError } = await service.from('availability_blocks').insert(
        blocks.map((block) => ({
          property_id: id,
          start_date: block.start,
          end_date: block.end,
          reason: block.reason ?? null,
          created_by: property.owner_id,
        })),
      );

      if (insertError) {
        console.error('Availability insert failed:', insertError);
        throw new HttpError(500, 'Could not save availability');
      }
    }

    return NextResponse.json({ blocks: blocks.map((block) => ({ ...block, reason: block.reason ?? null })) });
  } catch (error) {
    return errorResponse(error);
  }
}
