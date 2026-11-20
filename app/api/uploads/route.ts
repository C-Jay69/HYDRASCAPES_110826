import { NextResponse } from 'next/server';
import { createServiceClient } from '@/app/lib/supabase/service';
import { requireRole, errorResponse, HttpError } from '@/app/lib/authorization';
import { enforceRateLimit, RATE_LIMITS } from '@/app/lib/rate-limit';
import { normalizeImage } from '@/app/lib/storage/resize';
import {
  validateImageUpload,
  buildStoragePath,
  type BucketName,
} from '@/app/lib/storage/upload-validation';

/**
 * POST /api/uploads — multipart upload of one image to a private bucket.
 *
 * The file is validated, then re-encoded server-side (EXIF and GPS removed,
 * oversized photos scaled down) before it is written. Returns the storage
 * object path, never a URL: paths are what gets persisted in
 * `properties.photos`, and URLs are signed on demand (spec §7).
 */

const BUCKETS: readonly BucketName[] = [
  'property-photos',
  'inspection-photos',
  'message-media',
  'avatars',
];

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const bucket = String(formData.get('bucket') ?? 'property-photos') as BucketName;

    if (!BUCKETS.includes(bucket)) {
      throw new HttpError(400, 'Unknown upload bucket');
    }

    // Property and inspection photos are owner work; avatars and message media
    // are available to any signed-in user.
    const { supabase, user } =
      bucket === 'property-photos' || bucket === 'inspection-photos'
        ? await requireRole(['owner', 'admin'])
        : await requireRole(['owner', 'host', 'guest', 'admin']);

    await enforceRateLimit(supabase, `upload:${user.id}`, RATE_LIMITS.upload);

    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new HttpError(400, 'A file is required');
    }

    const validation = validateImageUpload(bucket, {
      size: file.size,
      type: file.type,
    });
    if (!validation.ok) {
      throw new HttpError(400, validation.reason);
    }

    let normalized;
    try {
      normalized = await normalizeImage(new Uint8Array(await file.arrayBuffer()));
    } catch (decodeError) {
      // A file the decoder rejects is not an image, whatever the browser said.
      console.error(`Upload rejected: undecodable image (${file.type}, ${file.size} bytes)`, decodeError);
      throw new HttpError(400, 'The file could not be read as an image');
    }

    const path = buildStoragePath(user.id, normalized.extension);

    const service = createServiceClient();
    const { error } = await service.storage.from(bucket).upload(path, normalized.buffer, {
      contentType: normalized.contentType,
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      console.error(`Upload to ${bucket} failed:`, error);
      throw new HttpError(500, 'Upload failed');
    }

    return NextResponse.json(
      {
        bucket,
        path,
        width: normalized.width,
        height: normalized.height,
        contentType: normalized.contentType,
        bytes: normalized.buffer.byteLength,
      },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
