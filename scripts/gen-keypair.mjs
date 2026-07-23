/**
 * Одноразово: сгенерировать пару ключей продавца для подписи лицензий.
 *   node scripts/gen-keypair.mjs
 * Приватный ключ ложится в secrets/signing-key.json (НЕ коммитить — .gitignore).
 * Публичный — вставить в src/lib/marketplace.ts → MARKETPLACE_PUBLIC_KEY.
 */
import * as ed from '@noble/ed25519';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const b64 = (u8) => Buffer.from(u8).toString('base64');

if (existsSync('secrets/signing-key.json')) {
  console.error('❌ secrets/signing-key.json уже существует. Удали вручную, если правда нужен новый ключ');
  process.exit(1);
}

const priv = ed.utils.randomSecretKey();
const pub = await ed.getPublicKeyAsync(priv);

mkdirSync('secrets', { recursive: true });
writeFileSync(
  'secrets/signing-key.json',
  JSON.stringify({ privateKey: b64(priv), publicKey: b64(pub) }, null, 2),
);

console.log('✅ Ключи созданы в secrets/signing-key.json');
console.log('\nВставь это в src/lib/marketplace.ts → MARKETPLACE_PUBLIC_KEY:\n');
console.log('  ' + b64(pub) + '\n');
