// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import * as ed from '@noble/ed25519';
import { redeemLicense, isOwned, ownedPackIds } from '../marketplace';

const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const b64url = (u: Uint8Array) => b64(u).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

/** Временная пара ключей: боевой приватный ключ в тесты не попадает. */
async function keypair() {
  const priv = ed.utils.randomSecretKey();
  const pub = await ed.getPublicKeyAsync(priv);
  return { priv, pubB64: b64(pub) };
}

/** Лицензия в том же формате, что печатает scripts/gen-license.mjs. */
async function license(priv: Uint8Array, payload: object) {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = await ed.signAsync(bytes, priv);
  return `THEDAD-${b64url(bytes)}.${b64url(sig)}`;
}

describe('лицензии маркетплейса', () => {
  beforeEach(() => localStorage.clear());

  it('подлинный ключ открывает паки', async () => {
    const { priv, pubB64 } = await keypair();
    const key = await license(priv, { v: 1, packs: { 'weight-loss-8w': 'k1', 'home-gym': 'k2' } });
    const ids = await redeemLicense(key, pubB64);
    expect(ids.sort()).toEqual(['home-gym', 'weight-loss-8w']);
    expect(isOwned('home-gym')).toBe(true);
  });

  it('подмена содержимого при сохранённой подписи отвергается', async () => {
    const { priv, pubB64 } = await keypair();
    const real = await license(priv, { v: 1, packs: { 'home-gym': 'k' } });
    const sig = real.split('.')[1];
    // Злоумышленник дописывает себе второй пак, подпись оставляет старую.
    const forgedPayload = new TextEncoder().encode(JSON.stringify({ v: 1, packs: { 'home-gym': 'k', 'weight-loss-8w': 'x' } }));
    await expect(redeemLicense(`THEDAD-${b64url(forgedPayload)}.${sig}`, pubB64)).rejects.toThrow(/подпись не совпадает/);
    expect(ownedPackIds()).toEqual([]);
  });

  it('ключ, подписанный чужим ключом, отвергается', async () => {
    const mine = await keypair();
    const stranger = await keypair();
    const key = await license(stranger.priv, { v: 1, packs: { 'home-gym': 'k' } });
    await expect(redeemLicense(key, mine.pubB64)).rejects.toThrow(/подпись не совпадает/);
  });

  it('боевой публичный ключ не принимает ключи, подписанные не нами', async () => {
    const stranger = await keypair();
    const key = await license(stranger.priv, { v: 1, packs: { 'home-gym': 'k' } });
    await expect(redeemLicense(key)).rejects.toThrow(/подпись не совпадает/);
  });

  it('мусор вместо ключа даёт понятную ошибку, а не падение', async () => {
    const { pubB64 } = await keypair();
    await expect(redeemLicense('привет', pubB64)).rejects.toThrow(/повреждён/);
    await expect(redeemLicense('THEDAD-abc.def', pubB64)).rejects.toThrow();
  });

  it('недопустимые id паков не записываются, даже с подлинной подписью', async () => {
    const { priv, pubB64 } = await keypair();
    const key = await license(priv, { v: 1, packs: { '../../evil': 'k', 'OK-UPPER': 'k' } });
    await expect(redeemLicense(key, pubB64)).rejects.toThrow(/нет допустимых паков/);
    expect(ownedPackIds()).toEqual([]);
  });
});
