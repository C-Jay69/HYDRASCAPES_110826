#!/usr/bin/env node
/**
 * Generates placeholder cover images for seeded properties and uploads them to
 * the private `property-photos` bucket.
 *
 * The properties seeded by 0005 and 0012 reference storage paths that do not
 * exist until this runs, so without it listings render "No photo yet". The
 * images are generated gradients labelled with the city — clearly fixtures,
 * not photographs of anything real.
 *
 * Usage: npm run seed:photos   (requires the local Supabase stack to be up)
 */

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const WIDTH = 1400;
const HEIGHT = 900;
const BUCKET = 'property-photos';

function loadEnv() {
  const env = {};
  for (const file of ['.env.local', '.env']) {
    if (!fs.existsSync(file)) continue;
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      env[match[1]] ??= match[2].replace(/^["']|["']$/g, '');
    }
  }
  return env;
}

function hueFor(id) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

function escapeXml(value) {
  return String(value).replace(/[<>&'"]/g, (char) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  })[char]);
}

function buildSvg({ city, title, hue, variant }) {
  const hueA = hue;
  const hueB = (hue + 40 + variant * 25) % 360;
  const label = escapeXml(city ?? 'Hydrascapes');
  const sub = escapeXml(title ?? '');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="hsl(${hueA},48%,34%)"/>
      <stop offset="55%" stop-color="hsl(${hueB},42%,18%)"/>
      <stop offset="100%" stop-color="hsl(${hueB},38%,9%)"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.78" cy="0.18" r="0.6">
      <stop offset="0%" stop-color="hsl(${hueA},70%,70%)" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="hsl(${hueA},70%,70%)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  ${variant === 0
    ? `<rect x="0" y="${HEIGHT * 0.62}" width="${WIDTH}" height="3" fill="rgba(255,255,255,0.18)"/>`
    : `<circle cx="${WIDTH * 0.8}" cy="${HEIGHT * 0.3}" r="150" fill="none" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>`}
  <text x="72" y="${HEIGHT - 118}" font-family="DejaVu Sans, Helvetica, sans-serif"
        font-size="62" font-weight="700" fill="rgba(255,255,255,0.94)">${label}</text>
  <text x="74" y="${HEIGHT - 68}" font-family="DejaVu Sans, Helvetica, sans-serif"
        font-size="30" fill="rgba(255,255,255,0.62)">${sub}</text>
</svg>`;
}

async function render({ city, title, hue, variant }) {
  try {
    return await sharp(Buffer.from(buildSvg({ city, title, hue, variant })))
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch (error) {
    // No font available? Fall back to a plain gradient rather than failing.
    console.warn(`  ! text render failed (${error.message}); using plain gradient`);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
      <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="hsl(${hue},48%,34%)"/>
        <stop offset="100%" stop-color="hsl(${(hue + 40) % 360},40%,10%)"/>
      </linearGradient></defs>
      <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
    </svg>`;
    return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  }
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, title, address_json, photos, cover_photo')
    .order('id');

  if (error) {
    console.error('Could not read properties:', error.message);
    process.exit(1);
  }

  console.log(`Generating photos for ${properties.length} properties…`);
  let uploaded = 0;
  let patched = 0;

  for (const property of properties) {
    const defaults = [`properties/${property.id}/cover.jpg`, `properties/${property.id}/01.jpg`];
    const paths = property.photos?.length ? property.photos : defaults;

    if (!property.photos?.length) {
      const { error: updateError } = await supabase
        .from('properties')
        .update({ photos: defaults, cover_photo: defaults[0] })
        .eq('id', property.id);
      if (updateError) {
        console.warn(`  ! could not attach photos to ${property.id}: ${updateError.message}`);
      } else {
        patched += 1;
      }
    }

    const city = property.address_json?.city ?? null;
    const hue = hueFor(property.id);

    for (const [index, storagePath] of paths.entries()) {
      const buffer = await render({
        city,
        title: property.title,
        hue,
        variant: index % 2,
      });

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, buffer, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) {
        console.warn(`  ! ${storagePath}: ${uploadError.message}`);
      } else {
        uploaded += 1;
      }
    }
  }

  // Ensure the cover of any property still lacking one points at a real object.
  for (const property of properties) {
    if (!property.cover_photo) {
      await supabase
        .from('properties')
        .update({ cover_photo: `properties/${property.id}/cover.jpg` })
        .eq('id', property.id);
    }
  }

  console.log(`Done. ${uploaded} images uploaded, ${patched} properties given photo paths.`);
  console.log(`Preview: ${url}/project/default/storage/buckets/${BUCKET}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
