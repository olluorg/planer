#!/usr/bin/env node
/**
 * Builds the Chrome extension into dist/:
 *   1. Vite build with base './' (relative assets for extension context)
 *   2. Generates PNG icons via raw PNG encoding (no external deps)
 *   3. Copies manifest.json and background.js into dist/
 */

import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── 1. Vite build ──────────────────────────────────────────────────────────
console.log('Building Vite app for extension…');
execSync('bunx vite build --config vite.config.ext.ts', { cwd: ROOT, stdio: 'inherit' });

// ── 2. PNG icon generation ─────────────────────────────────────────────────
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = crcTable[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function mkChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
  const crcBuf = Buffer.alloc(4); crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])));
  return Buffer.concat([len, t, d, crcBuf]);
}

function makePng(size, [r, g, b]) {
  const margin = Math.round(size * 0.18);
  const rows = [];
  for (let y = 0; y < size; y++) {
    const row = new Uint8Array(1 + size * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < size; x++) {
      const dx = Math.min(x, size - 1 - x);
      const dy = Math.min(y, size - 1 - y);
      const inCorner = dx < margin && dy < margin;
      const transparent = inCorner &&
        (margin - dx) ** 2 + (margin - dy) ** 2 > margin ** 2;
      const i = 1 + x * 4;
      if (transparent) {
        row[i] = 0; row[i + 1] = 0; row[i + 2] = 0; row[i + 3] = 0;
      } else {
        row[i] = r; row[i + 1] = g; row[i + 2] = b; row[i + 3] = 255;
      }
    }
    rows.push(Buffer.from(row));
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; // 8-bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    mkChunk('IHDR', ihdr),
    mkChunk('IDAT', deflateSync(Buffer.concat(rows))),
    mkChunk('IEND', Buffer.alloc(0)),
  ]);
}

const ICONS_DIR = join(ROOT, 'dist', 'icons');
mkdirSync(ICONS_DIR, { recursive: true });
const GREEN = [34, 197, 94]; // #22c55e
for (const size of [16, 48, 128]) {
  writeFileSync(join(ICONS_DIR, `icon${size}.png`), makePng(size, GREEN));
}
console.log('Icons generated.');

// ── 3. Copy extension files ────────────────────────────────────────────────
copyFileSync(join(ROOT, 'chrome-extension', 'manifest.json'), join(ROOT, 'dist', 'manifest.json'));
copyFileSync(join(ROOT, 'chrome-extension', 'background.js'),  join(ROOT, 'dist', 'background.js'));
console.log('Extension files copied.');

console.log('\n✓ Extension built to dist/');
console.log('  Load it in chrome://extensions → Developer mode → Load unpacked → select dist/');
