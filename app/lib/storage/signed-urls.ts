/**
 * Short-lived signed URLs for private storage objects (spec §7).
 *
 * Every bucket is private, so a stored object path is never turned into a
 * `/object/public/...` URL. Paths are resolved to signed URLs server-side,
 * with the shortest lifetime that gets the job done.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { PhotoUrlResolver } from '@/app/core/usecases/analyze-property.use';

/** Long enough for a vision call to download the images, short enough to be disposable. */
export const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;

export function createSignedUrlResolver(
  client: SupabaseClient,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
): PhotoUrlResolver {
  return {
    async signedUrls(bucket: string, paths: string[]): Promise<string[]> {
      if (paths.length === 0) return [];

      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrls(paths, expiresInSeconds);

      if (error || !data) {
        console.error(`Failed to sign URLs for bucket ${bucket}:`, error);
        return [];
      }

      return data
        .filter((entry) => Boolean(entry.signedUrl))
        .map((entry) => entry.signedUrl as string);
    },
  };
}

/** Signs a single object, for rendering one image in a server component. */
export async function signedUrlFor(
  client: SupabaseClient,
  bucket: string,
  path: string,
  expiresInSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
): Promise<string | null> {
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error(`Failed to sign ${bucket}/${path}:`, error);
    return null;
  }
  return data.signedUrl;
}
