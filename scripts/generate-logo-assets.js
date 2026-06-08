// Generates web-optimized brand logo variants from the 4K master PNG.
// Run with: node scripts/generate-logo-assets.js
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const SRC = path.join(__dirname, 'master_logo_4k.png');
const pub = path.join(root, 'public');
const img = path.join(pub, 'images');

const BLACK = { r: 0, g: 0, b: 0, alpha: 1 };

// Fit the (portrait) artwork into a square canvas padded on black — the art
// already sits on a black background, so the result reads as a clean badge.
async function square(size, out) {
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: BLACK })
    .flatten({ background: BLACK })
    .png({ compressionLevel: 9 })
    .toFile(out);
}

// Minimal ICO encoder that embeds PNG images (supported by all modern browsers).
function buildIco(pngBuffers) {
  const count = pngBuffers.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(count, 4);

  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  const parts = [];
  pngBuffers.forEach((b, i) => {
    const base = i * 16;
    const dim = b.size >= 256 ? 0 : b.size; // 0 means 256
    dir.writeUInt8(dim, base + 0); // width
    dir.writeUInt8(dim, base + 1); // height
    dir.writeUInt8(0, base + 2);   // palette
    dir.writeUInt8(0, base + 3);   // reserved
    dir.writeUInt16LE(1, base + 4);   // color planes
    dir.writeUInt16LE(32, base + 6);  // bits per pixel
    dir.writeUInt32LE(b.buf.length, base + 8); // size of PNG data
    dir.writeUInt32LE(offset, base + 12);      // offset
    offset += b.buf.length;
    parts.push(b.buf);
  });
  return Buffer.concat([header, dir, ...parts]);
}

async function main() {
  fs.mkdirSync(img, { recursive: true });

  // Header mark — compact, height ~240px (portrait art ~180×240), target ~90 KB.
  await sharp(SRC)
    .resize({ height: 240 })
    .png({ compressionLevel: 9, quality: 90 })
    .toFile(path.join(img, 'logo-header.png'));

  // Login / hero version — longest side ~640px.
  await sharp(SRC)
    .resize({ height: 640 })
    .png({ compressionLevel: 9, quality: 92 })
    .toFile(path.join(img, 'logo-hero.png'));

  // Square favicons / touch icons, padded on black.
  await square(16, path.join(pub, 'favicon-16x16.png'));
  await square(32, path.join(pub, 'favicon-32x32.png'));
  await square(180, path.join(pub, 'apple-touch-icon.png'));
  await square(192, path.join(pub, 'android-chrome-192x192.png'));
  await square(512, path.join(pub, 'android-chrome-512x512.png'));

  // Multi-resolution favicon.ico (16/32/48).
  const icoSizes = [16, 32, 48];
  const buffers = [];
  for (const size of icoSizes) {
    const buf = await sharp(SRC)
      .resize(size, size, { fit: 'contain', background: BLACK })
      .flatten({ background: BLACK })
      .png({ compressionLevel: 9 })
      .toBuffer();
    buffers.push({ size, buf });
  }
  fs.writeFileSync(path.join(pub, 'favicon.ico'), buildIco(buffers));

  // Report sizes.
  const report = (p) => `${path.relative(root, p)}: ${(fs.statSync(p).size / 1024).toFixed(1)} KB`;
  console.log('Generated assets:');
  [
    path.join(img, 'logo-header.png'),
    path.join(img, 'logo-hero.png'),
    path.join(pub, 'favicon-16x16.png'),
    path.join(pub, 'favicon-32x32.png'),
    path.join(pub, 'apple-touch-icon.png'),
    path.join(pub, 'android-chrome-192x192.png'),
    path.join(pub, 'android-chrome-512x512.png'),
    path.join(pub, 'favicon.ico'),
  ].forEach((p) => console.log('  ' + report(p)));
}

main().catch((e) => { console.error(e); process.exit(1); });
