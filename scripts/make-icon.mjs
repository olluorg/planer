// Собирает иконку приложения из бренд-орба: public/logo-dark.png (белый орб на прозрачном)
// кладётся на тёмную скруглённую плитку. На прозрачном фоне белый орб пропадал бы
// на светлой панели задач, поэтому подложка обязательна.
// Запуск: node scripts/make-icon.mjs → build/icon.png (1024×1024, из него electron-builder делает .ico)
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SIZE = 1024;
const RADIUS = 180;      // ~17.5% — близко к squircle Windows/macOS
const ORB = 660;         // орб занимает ~64% плитки, поля дышат
const BG = '#14161f';

const tile = Buffer.from(
  `<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
     <rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" ry="${RADIUS}" fill="${BG}"/>
   </svg>`,
);

const orb = await sharp(path.join(root, 'public', 'logo-dark.png'))
  .trim()                                            // срезаем прозрачные поля исходника
  .resize(ORB, ORB, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer();

await mkdir(path.join(root, 'build'), { recursive: true });
await sharp(tile)
  .composite([{ input: orb, gravity: 'centre' }])
  .png()
  .toFile(path.join(root, 'build', 'icon.png'));

console.log('build/icon.png готова');
