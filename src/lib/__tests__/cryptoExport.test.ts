import { describe, it, expect } from 'vitest';
import { encryptBytes, decryptBytes } from '../cryptoExport';

const bytes = (s: string) => new TextEncoder().encode(s);
const text = (b: Uint8Array) => new TextDecoder().decode(b);

describe('cryptoExport', () => {
  it('круг шифрование → расшифровка возвращает исходные байты', async () => {
    const src = bytes('данные пользователя');
    const out = await decryptBytes(await encryptBytes(src, 'пароль'), 'пароль');
    expect(text(out)).toBe('данные пользователя');
  });

  it('неверный пароль не расшифровывает', async () => {
    const enc = await encryptBytes(bytes('секрет'), 'правильный');
    await expect(decryptBytes(enc, 'неправильный')).rejects.toBeTruthy();
  });

  it('шифротекст не содержит открытый текст', async () => {
    const enc = await encryptBytes(bytes('PLAINTEXT-MARKER'), 'pw');
    expect(text(enc)).not.toContain('PLAINTEXT-MARKER');
  });

  it('два шифрования одних данных дают разный шифротекст (случайные salt/iv)', async () => {
    const a = await encryptBytes(bytes('одно и то же'), 'pw');
    const b = await encryptBytes(bytes('одно и то же'), 'pw');
    expect(a).not.toEqual(b);
    expect(text(await decryptBytes(a, 'pw'))).toBe(text(await decryptBytes(b, 'pw')));
  });

  it('повреждённый шифротекст отвергается, а не отдаёт мусор', async () => {
    const enc = await encryptBytes(bytes('целостность важна'), 'pw');
    enc[enc.length - 1] ^= 0xff;
    await expect(decryptBytes(enc, 'pw')).rejects.toBeTruthy();
  });

  it('пустой вход переживает круг', async () => {
    const out = await decryptBytes(await encryptBytes(new Uint8Array(0), 'pw'), 'pw');
    expect(out.length).toBe(0);
  });

  it('крупный бинарный блоб (дамп БД) переживает круг без искажений', async () => {
    const src = new Uint8Array(256 * 1024);
    for (let i = 0; i < src.length; i++) src[i] = (i * 31) % 256;
    const out = await decryptBytes(await encryptBytes(src, 'pw'), 'pw');
    expect(out).toEqual(src);
  });
});
