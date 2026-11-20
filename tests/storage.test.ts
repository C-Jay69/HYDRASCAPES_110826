/**
 * Image pipeline tests (spec §7, §29).
 *
 * Uses sharp to fabricate inputs, then asserts the normalization actually
 * strips metadata and bounds dimensions rather than trusting the upload.
 */

import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { normalizeImage } from '../app/lib/storage/resize';
import { validateImageUpload } from '../app/lib/storage/upload-validation';

async function jpegWithExif(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 40, g: 80, b: 120 } },
  })
    .jpeg()
    .withMetadata({ exif: { IFD0: { Make: 'TestCam', Model: 'Hydra' } } })
    .toBuffer();
  return new Uint8Array(buffer);
}

describe('normalizeImage', () => {
  it('strips EXIF metadata, including camera identity', async () => {
    const input = await jpegWithExif(800, 600);

    const withExif = await sharp(Buffer.from(input)).metadata();
    expect(withExif.exif).toBeDefined();

    const result = await normalizeImage(input);
    const output = await sharp(result.buffer).metadata();

    expect(output.exif).toBeUndefined();
    expect(result.contentType).toBe('image/webp');
    expect(result.extension).toBe('webp');
  });

  it('scales oversized images down but does not enlarge small ones', async () => {
    const large = await normalizeImage(await jpegWithExif(2600, 1400));
    expect(Math.max(large.width, large.height)).toBeLessThanOrEqual(2048);

    const small = await normalizeImage(await jpegWithExif(320, 240));
    expect(small.width).toBe(320);
    expect(small.height).toBe(240);
  });

  it('preserves PNG transparency as PNG', async () => {
    const png = await sharp({
      create: { width: 100, height: 100, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0.5 } },
    })
      .png()
      .toBuffer();

    const result = await normalizeImage(new Uint8Array(png));
    expect(result.contentType).toBe('image/png');
    expect(result.extension).toBe('png');
  });

  it('rejects bytes that are not an image', async () => {
    await expect(normalizeImage(new TextEncoder().encode('definitely not an image'))).rejects.toThrow();
  });
});

describe('validateImageUpload', () => {
  it('rejects a type outside the allow-list', () => {
    const result = validateImageUpload('property-photos', { size: 1000, type: 'image/gif' });
    expect(result.ok).toBe(false);
  });

  it('rejects files over the bucket limit', () => {
    const result = validateImageUpload('avatars', { size: 3 * 1024 * 1024, type: 'image/jpeg' });
    expect(result.ok).toBe(false);
  });

  it('accepts a valid upload', () => {
    const result = validateImageUpload('property-photos', { size: 1000, type: 'image/jpeg' });
    expect(result).toMatchObject({ ok: true, contentType: 'image/jpeg', extension: 'jpg' });
  });
});
