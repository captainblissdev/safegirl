/**
 * Generates the SafeGirl app icons in public/ with no dependencies beyond
 * Node itself (zlib for PNG compression). Dev-only; run after changing the
 * design and commit the output:
 *
 *   npm run generate-icons
 *
 * The design matches public/safegirl-icon.svg: a cream heart (--paper) in
 * a teal circle (--teal). Shapes are drawn in a 100 x 100 unit space and
 * rasterised with 4 x 4 supersampling for smooth edges.
 *
 * Output:
 *   pwa-192x192.png, pwa-512x512.png  transparent corners, purpose "any"
 *   maskable-512x512.png              full-bleed teal, heart in the safe zone
 *   apple-touch-icon.png (180)        full-bleed teal (iOS shows no alpha)
 *   favicon.ico                       16, 32 and 48 px PNGs in one ICO
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const PUBLIC_DIR = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
);

const TEAL = [0x17, 0x6b, 0x68];
const PAPER = [0xff, 0xfd, 0xf8];
const SUPERSAMPLE = 4;

// The heart from safegirl-icon.svg: a start point and cubic Bezier segments.
const HEART_START = [50, 75];
const HEART_CURVES = [
  [31, 62, 24, 52, 24, 41],
  [24, 32, 31, 26, 38.5, 26],
  [44, 26, 48, 29.5, 50, 34],
  [52, 29.5, 56, 26, 61.5, 26],
  [69, 26, 76, 32, 76, 41],
  [76, 52, 69, 62, 50, 75],
];

/** The heart outline as a polygon (each Bezier flattened to 48 points). */
function heartPolygon() {
  const points = [HEART_START];
  let [x0, y0] = HEART_START;
  for (const [x1, y1, x2, y2, x3, y3] of HEART_CURVES) {
    for (let i = 1; i <= 48; i++) {
      const t = i / 48;
      const u = 1 - t;
      points.push([
        u * u * u * x0 +
          3 * u * u * t * x1 +
          3 * u * t * t * x2 +
          t * t * t * x3,
        u * u * u * y0 +
          3 * u * u * t * y1 +
          3 * u * t * t * y2 +
          t * t * t * y3,
      ]);
    }
    [x0, y0] = [x3, y3];
  }
  return points;
}

const HEART = heartPolygon();

/** Horizontal spans (in units) where the circle covers row y. */
function circleSpans(y) {
  const dy = y - 50;
  if (Math.abs(dy) >= 50) return [];
  const dx = Math.sqrt(50 * 50 - dy * dy);
  return [[50 - dx, 50 + dx]];
}

/** Horizontal spans (in units) where the heart covers row y (even-odd). */
function heartSpans(y) {
  const xs = [];
  for (let i = 0; i < HEART.length - 1; i++) {
    const [ax, ay] = HEART[i];
    const [bx, by] = HEART[i + 1];
    if ((ay <= y && by > y) || (by <= y && ay > y)) {
      xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
    }
  }
  xs.sort((a, b) => a - b);
  const spans = [];
  for (let i = 0; i + 1 < xs.length; i += 2) spans.push([xs[i], xs[i + 1]]);
  return spans;
}

/**
 * Per-pixel coverage (0..1) of a shape, given its spans per unit row.
 * scale shrinks the 100-unit design about the centre (1 = edge to edge).
 */
function coverage(size, scale, spansAt) {
  const cover = new Float64Array(size * size);
  const toPx = (u) => ((u - 50) / 100) * scale * size + size / 2;
  const toUnit = (px) => ((px - size / 2) / (scale * size)) * 100 + 50;

  for (let py = 0; py < size; py++) {
    for (let s = 0; s < SUPERSAMPLE; s++) {
      const y = toUnit(py + (s + 0.5) / SUPERSAMPLE);
      for (const [u0, u1] of spansAt(y)) {
        const x0 = Math.max(0, toPx(u0));
        const x1 = Math.min(size, toPx(u1));
        for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
          const overlap = Math.min(x1, px + 1) - Math.max(x0, px);
          if (overlap > 0) cover[py * size + px] += overlap / SUPERSAMPLE;
        }
      }
    }
  }
  return cover;
}

/** RGBA pixels: optional background, then the circle, then the heart. */
function render(size, { background = null, scale = 1 } = {}) {
  const circle = coverage(size, scale, circleSpans);
  const heart = coverage(size, scale, heartSpans);
  const pixels = Buffer.alloc(size * size * 4);

  for (let i = 0; i < size * size; i++) {
    // Premultiplied "over" compositing, back to front.
    let [r, g, b, a] = background ? [...background, 1] : [0, 0, 0, 0];
    r *= a;
    g *= a;
    b *= a;
    for (const [color, alpha] of [
      [TEAL, Math.min(1, circle[i])],
      [PAPER, Math.min(1, heart[i])],
    ]) {
      r = color[0] * alpha + r * (1 - alpha);
      g = color[1] * alpha + g * (1 - alpha);
      b = color[2] * alpha + b * (1 - alpha);
      a = alpha + a * (1 - alpha);
    }
    pixels[i * 4] = a > 0 ? Math.round(r / a) : 0;
    pixels[i * 4 + 1] = a > 0 ? Math.round(g / a) : 0;
    pixels[i * 4 + 2] = a > 0 ? Math.round(b / a) : 0;
    pixels[i * 4 + 3] = Math.round(a * 255);
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** An 8-bit RGBA PNG. */
function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8); // bit depth 8, RGBA, no interlace
  const rows = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    rows[y * (size * 4 + 1)] = 0; // filter: none
    pixels.copy(rows, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** An ICO file holding one PNG per size. */
function encodeIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ size, png }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)]);
}

const png = (size, options) => encodePng(size, render(size, options));
const write = (name, data) => {
  writeFileSync(join(PUBLIC_DIR, name), data);
  console.log(`wrote public/${name} (${data.length} bytes)`);
};

write("pwa-192x192.png", png(192));
write("pwa-512x512.png", png(512));
// Maskable: the platform may crop to a circle of 80% diameter, so the
// heart is drawn at 80% scale on a full-bleed teal background.
write("maskable-512x512.png", png(512, { background: TEAL, scale: 0.8 }));
write("apple-touch-icon.png", png(180, { background: TEAL }));
write(
  "favicon.ico",
  encodeIco([16, 32, 48].map((size) => ({ size, png: png(size) }))),
);
