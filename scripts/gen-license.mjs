/**
 * Выдать лиценз-ключ покупателю (запускать после оплаты).
 *   node scripts/gen-license.mjs <packId[,packId2,...]> [buyer]
 * Пример:
 *   node scripts/gen-license.mjs weight-loss-8w ivan@mail.ru
 *
 * Читает secrets/signing-key.json (приватный) и secrets/pack-keys.json (ключи паков),
 * печатает лиценз-ключ THEDAD-... — его и отдаёшь покупателю. Ничего не хранит на сервере.
 */
import * as ed from '@noble/ed25519';
import { readFileSync, existsSync } from 'node:fs';

const [packsArg, buyer] = process.argv.slice(2);
if (!packsArg) {
  console.error('Использование: node scripts/gen-license.mjs <packId[,packId2]> [buyer]');
  process.exit(1);
}
if (!existsSync('secrets/signing-key.json')) {
  console.error('❌ Нет secrets/signing-key.json — сначала node scripts/gen-keypair.mjs');
  process.exit(1);
}
if (!existsSync('secrets/pack-keys.json')) {
  console.error('❌ Нет secrets/pack-keys.json — сначала зашифруй пак: node scripts/pack-encrypt.mjs');
  process.exit(1);
}

const { privateKey } = JSON.parse(readFileSync('secrets/signing-key.json', 'utf8'));
const packKeys = JSON.parse(readFileSync('secrets/pack-keys.json', 'utf8'));

const ids = packsArg.split(',').map((s) => s.trim()).filter(Boolean);
const packs = {};
for (const id of ids) {
  if (!packKeys[id]) {
    console.error(`❌ Нет ключа для пака "${id}" в secrets/pack-keys.json (зашифруй его pack-encrypt.mjs)`);
    process.exit(1);
  }
  packs[id] = packKeys[id];
}

const payload = { v: 1, packs, ...(buyer ? { buyer } : {}), iat: Math.floor(Date.now() / 1000) };
const payloadBytes = Buffer.from(JSON.stringify(payload), 'utf8');

const priv = Buffer.from(privateKey, 'base64');
const sig = await ed.signAsync(new Uint8Array(payloadBytes), new Uint8Array(priv));

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const license = `THEDAD-${b64url(payloadBytes)}.${b64url(sig)}`;

console.log(`\n✅ Лиценз-ключ для [${ids.join(', ')}]${buyer ? ` (${buyer})` : ''}:\n`);
console.log(license + '\n');
