/**
 * Зашифровать пак-программу для витрины.
 *   node scripts/pack-encrypt.mjs <input.json> <packId>
 * Пример:
 *   node scripts/pack-encrypt.mjs content/programs/weight-loss-8w.json weight-loss-8w
 *
 * На выходе: public/marketplace/<packId>.pack (AES-256-GCM, iv+ct||tag base64).
 * Ключ пака (один на всех покупателей) сохраняется в secrets/pack-keys.json —
 * из него gen-license.mjs собирает лиценз-ключи. Ключ пака НЕ коммитить.
 */
import { createCipheriv, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const [input, packId] = process.argv.slice(2);
if (!input || !packId) {
  console.error('Использование: node scripts/pack-encrypt.mjs <input.json> <packId>');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(packId)) {
  console.error('❌ packId — slug из a-z, 0-9, дефисов (2–64 символа)');
  process.exit(1);
}

// Проверим, что вход — валидный JSON программы нужного id
const plaintext = readFileSync(input, 'utf8');
let prog;
try {
  prog = JSON.parse(plaintext);
} catch {
  console.error('❌ Вход не является JSON');
  process.exit(1);
}
if (prog.schema !== 'thedad.program/v1') console.warn('⚠️  schema != thedad.program/v1');
if (prog.id !== packId) {
  console.error(`❌ prog.id ("${prog.id}") не совпадает с packId ("${packId}") — приложение отвергнет пак`);
  process.exit(1);
}

// Ключ пака: переиспользуем существующий (чтобы уже выданные лицензии продолжали работать), иначе новый
mkdirSync('secrets', { recursive: true });
const KEYS_PATH = 'secrets/pack-keys.json';
const keys = existsSync(KEYS_PATH) ? JSON.parse(readFileSync(KEYS_PATH, 'utf8')) : {};
const keyB64 = keys[packId] || randomBytes(32).toString('base64');
keys[packId] = keyB64;
writeFileSync(KEYS_PATH, JSON.stringify(keys, null, 2));

const key = Buffer.from(keyB64, 'base64');
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
const tag = cipher.getAuthTag();

mkdirSync('public/marketplace', { recursive: true });
const outPath = `public/marketplace/${packId}.pack`;
writeFileSync(
  outPath,
  JSON.stringify({ v: 1, iv: iv.toString('base64'), ct: Buffer.concat([ct, tag]).toString('base64') }),
);

console.log(`✅ Зашифровано → ${outPath}`);
console.log(`   ключ пака сохранён в ${KEYS_PATH} (используй gen-license.mjs)`);
