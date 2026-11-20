/**
 * Server-side image normalization (spec §7).
 *
 * Every uploaded property image is re-encoded before it reaches storage:
 *
 *  - EXIF orientation is applied and then all metadata (including GPS) is
 *    dropped — `sharp` only copies metadata when explicitly asked to;
 *  - oversized photos are scaled down to `VISION_IMAGE_MAX_PX`;
 *  - the declared content type is never trusted on its own, because the
 *    output type is derived from the decoder that actually handled the bytes.
 */

import sharp from 'sharp';

/** Guard against decompression bombs: ~50 megapixels. */
const MAX_INPUT_PIXELS = 50_000_000;

export interface NormalizedImage {
  buffer: Buffer;
  contentType: 'image/jpeg' | 'image/png' | 'image/webp';
  extension: 'jpg' | 'png' | 'webp';
  width: number;
  height: number;
  /** Bytes removed relative to the upload, for observability. */
  originalBytes: number;
}

function maxDimension(): number {
  const configured = Number(process.env.VISION_IMAGE_MAX_PX ?? '2048');
  if (!Number.isFinite(configured) || configured < 256) return 2048;
  return Math.min(4096, Math.trunc(configured));
}

function quality(): number {
  const configured = Number(process.env.VISION_JPEG_QUALITY ?? '82');
  if (!Number.isFinite(configured) || configured < 40) return 82;
  return Math.min(95, Math.trunc(configured));
}

/**
 * Normalizes an uploaded image.
 *
 * PNG stays PNG (it may carry transparency); everything else becomes WebP.
 * Throws for anything the decoder rejects — a file that cannot be decoded must
 * never be stored.
 */
export async function normalizeImage(input: Uint8Array): Promise<NormalizedImage> {
  const pipeline = sharp(input, {
    limitInputPixels: MAX_INPUT_PIXELS,
    // Apply EXIF orientation before anything else.
    failOn: 'error',
  }).rotate();

  const metadata = await pipeline.metadata();
  const sourceFormat = metadata.format;

  const resized = pipeline.resize({
    width: maxDimension(),
    height: maxDimension(),
    fit: 'inside',
    withoutEnlargement: true,
  });

  let output: { data: Buffer; info: { width: number; height: number; format: string } };

  if (sourceFormat === 'png') {
    output = await resized.png({ compressionLevel: 9 }).toBuffer({ resolveWithObject: true });
  } else {
    output = await resized
      .webp({ quality: quality(), effort: 4 })
      .toBuffer({ resolveWithObject: true });
  }

  const isPng = output.info.format === 'png';

  return {
    buffer: output.data,
    contentType: isPng ? 'image/png' : 'image/webp',
    extension: isPng ? 'png' : 'webp',
    width: output.info.width,
    height: output.info.height,
    originalBytes: input.byteLength,
  };
}
