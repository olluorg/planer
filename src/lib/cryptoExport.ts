// AES-GCM encryption of arbitrary bytes using a passphrase (PBKDF2-derived key).
// Output layout: magic(4) | salt(16) | iv(12) | ciphertext

const MAGIC = new Uint8Array([0x54, 0x44, 0x44, 0x01]); // 'TDD\1'
const ITERATIONS = 250_000;

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptBytes(data: Uint8Array, passphrase: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource));
  const out = new Uint8Array(MAGIC.length + salt.length + iv.length + ct.length);
  out.set(MAGIC, 0);
  out.set(salt, MAGIC.length);
  out.set(iv, MAGIC.length + salt.length);
  out.set(ct, MAGIC.length + salt.length + iv.length);
  return out;
}

export async function decryptBytes(blob: Uint8Array, passphrase: string): Promise<Uint8Array> {
  for (let i = 0; i < MAGIC.length; i++) {
    if (blob[i] !== MAGIC[i]) throw new Error('Не зашифрованный файл (неверный заголовок)');
  }
  const salt = blob.slice(MAGIC.length, MAGIC.length + 16);
  const iv = blob.slice(MAGIC.length + 16, MAGIC.length + 28);
  const ct = blob.slice(MAGIC.length + 28);
  const key = await deriveKey(passphrase, salt);
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, ct as BufferSource));
}
