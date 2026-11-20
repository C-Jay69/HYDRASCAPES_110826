/**
 * Upload validation (spec §7).
 *
 * Checked on the server before anything is written to storage. The browser
 * may pre-check to give fast feedback, but the server check is the one that
 * counts: `accept=` on an input is a hint, not a control.
 */

export const BUCKET_LIMITS = {
  'property-photos': { maxBytes: 10 * 1024 * 1024 },
  'inspection-photos': { maxBytes: 10 * 1024 * 1024 },
  'message-media': { maxBytes: 10 * 1024 * 1024 },
  avatars: { maxBytes: 2 * 1024 * 1024 },
} as const;

export type BucketName = keyof typeof BUCKET_LIMITS;

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Extensions are derived from the type, never from the client-supplied name. */
const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

export interface ValidatedUpload {
  ok: true;
  contentType: string;
  extension: string;
}

export interface InvalidUpload {
  ok: false;
  reason: string;
}

export function validateImageUpload(
  bucket: BucketName,
  file: { size: number; type: string },
): ValidatedUpload | InvalidUpload {
  const limit = BUCKET_LIMITS[bucket];
  if (!limit) return { ok: false, reason: 'Unknown bucket' };

  const contentType = file.type.toLowerCase();
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    return { ok: false, reason: 'Only JPEG, PNG and WebP images are accepted' };
  }

  if (!Number.isFinite(file.size) || file.size <= 0) {
    return { ok: false, reason: 'File is empty' };
  }

  if (file.size > limit.maxBytes) {
    return {
      ok: false,
      reason: `File exceeds the ${Math.round(limit.maxBytes / (1024 * 1024))} MB limit`,
    };
  }

  return { ok: true, contentType, extension: EXTENSION_BY_TYPE[contentType] };
}

/**
 * Builds a safe storage path: `<userId>/<random>.<ext>`.
 *
 * The first path segment is the owner id, which is exactly what the storage
 * policies in `0009_storage_object_policies.sql` check. The original filename
 * is never used, so nothing client-supplied reaches the object key.
 */
export function buildStoragePath(userId: string, extension: string): string {
  return `${userId}/${crypto.randomUUID()}.${extension}`;
}
