// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clear } from 'idb-keyval';
import { exportPersonalData, parsePersonalData, restorePersonalData, restorePersonalRecovery, hasPersonalRecovery } from '../personalBackup';

beforeEach(async () => { localStorage.clear(); await clear(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('personal data backup', () => {
  it('backs up program photos and goals and restores the prior snapshot', async () => {
    const photo = JSON.stringify({ before: 'data:image/jpeg;base64,YWJj' });
    localStorage.setItem('hub.photos.home-gym', photo);
    localStorage.setItem('hub.goals.home-gym', '["Сила"]');
    localStorage.setItem('hub.secret.home-gym', 'do-not-export');
    const file = parsePersonalData(exportPersonalData());
    expect(JSON.stringify(file)).not.toContain('do-not-export');
    localStorage.setItem('hub.goals.home-gym', '["До импорта"]');
    localStorage.removeItem('hub.photos.home-gym');
    await restorePersonalData(file);
    expect(localStorage.getItem('hub.photos.home-gym')).toBe(photo);
    expect(localStorage.getItem('hub.goals.home-gym')).toBe('["Сила"]');
    await restorePersonalRecovery();
    expect(localStorage.getItem('hub.photos.home-gym')).toBeNull();
    expect(localStorage.getItem('hub.goals.home-gym')).toBe('["До импорта"]');
  });

  it('preserves program data when importing an older backup without it', async () => {
    const { hubs: _hubs, ...old } = exportPersonalData();
    localStorage.setItem('hub.goals.home-gym', '["Оставить"]');
    await restorePersonalData(parsePersonalData(old));
    expect(localStorage.getItem('hub.goals.home-gym')).toBe('["Оставить"]');
  });

  it('rejects non-allowlisted program keys and invalid photo data', () => {
    const file = exportPersonalData();
    expect(() => parsePersonalData({ ...file, hubs: { 'hub.secret.home-gym': 'secret' } })).toThrow();
    expect(() => parsePersonalData({ ...file, hubs: { 'hub.photos.home-gym': '{"before":"https://example.com/image"}' } })).toThrow();
  });
  it('round-trips a diary entry with unknown calories', async () => {
    const original = '{"2026-11-02":[{"key":"soup","title":"Суп","meal":"Обед"}]}';
    localStorage.setItem('nutrition.eaten.v1', original);
    const file = parsePersonalData(exportPersonalData());
    localStorage.removeItem('nutrition.eaten.v1');
    await restorePersonalData(file);
    expect(localStorage.getItem('nutrition.eaten.v1')).toBe(original);
  });
  it('exports only approved data and restores a previous snapshot', async () => {
    localStorage.setItem('user.name.v1', 'Анна');
    localStorage.setItem('nutrition.eaten.v1', '{"2026-10-29":[]}');
    localStorage.setItem('thedad.drive.pass', 'secret');
    const file = exportPersonalData();
    expect(JSON.stringify(file)).not.toContain('secret');
    localStorage.setItem('user.name.v1', 'Иван');
    await restorePersonalData(parsePersonalData(file));
    expect(localStorage.getItem('user.name.v1')).toBe('Анна');
    expect(localStorage.getItem('thedad.drive.pass')).toBe('secret');
    expect(await hasPersonalRecovery()).toBe(true);
    await restorePersonalRecovery();
    expect(localStorage.getItem('user.name.v1')).toBe('Иван');
  });

  it('rejects unexpected keys and malformed journal data before changing storage', async () => {
    localStorage.setItem('user.name.v1', 'Неприкосновенно');
    const file = exportPersonalData();
    const invalid = {...file, values:{...file.values, 'nutrition.eaten.v1':'[]'}};
    await expect(restorePersonalData(invalid)).rejects.toThrow();
    expect(() => parsePersonalData({...file, values:{...file.values, 'thedad.drive.pass':'bad'}})).toThrow();
    expect(localStorage.getItem('user.name.v1')).toBe('Неприкосновенно');
    expect(await hasPersonalRecovery()).toBe(false);
  });

  it('imports a valid backup over damaged local data and preserves the exact previous state', async () => {
    localStorage.setItem('user.name.v1', 'Из копии');
    const incoming = exportPersonalData();
    localStorage.setItem('user.name.v1', 'До импорта');
    localStorage.setItem('nutrition.eaten.v1', '{повреждено');
    await restorePersonalData(incoming);
    expect(localStorage.getItem('user.name.v1')).toBe('Из копии');
    expect(localStorage.getItem('nutrition.eaten.v1')).toBeNull();
    await restorePersonalRecovery();
    expect(localStorage.getItem('user.name.v1')).toBe('До импорта');
    expect(localStorage.getItem('nutrition.eaten.v1')).toBe('{повреждено');
  });

  it('keeps the recovery snapshot available if recovery fails', async () => {
    localStorage.setItem('user.name.v1', 'До импорта');
    const incoming = exportPersonalData();
    incoming.values['user.name.v1'] = 'После импорта';
    await restorePersonalData(incoming);
    const storage = localStorage;
    let failOnce = true;
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => storage.getItem(key),
      removeItem: (key: string) => storage.removeItem(key),
      setItem: (key: string, value: string) => {
        if (key === 'user.name.v1' && value === 'До импорта' && failOnce) { failOnce = false; throw new Error('quota exceeded'); }
        storage.setItem(key, value);
      },
    });
    await expect(restorePersonalRecovery()).rejects.toThrow('quota exceeded');
    expect(localStorage.getItem('user.name.v1')).toBe('После импорта');
    await restorePersonalRecovery();
    expect(localStorage.getItem('user.name.v1')).toBe('До импорта');
  });

  it('rolls back local values if writing the imported snapshot fails', async () => {
    const data = new Map<string, string>([['user.name.v1', 'До импорта']]);
    vi.stubGlobal('localStorage', {
      getItem: (key:string) => data.get(key) ?? null,
      removeItem: (key:string) => data.delete(key),
      setItem: (key:string, value:string) => { if (key === 'user.name.v1' && value === 'После импорта') throw new Error('quota exceeded'); data.set(key, value); },
    });
    const incoming = exportPersonalData();
    incoming.values['user.name.v1'] = 'После импорта';
    await expect(restorePersonalData(incoming)).rejects.toThrow('quota exceeded');
    expect(localStorage.getItem('user.name.v1')).toBe('До импорта');
    expect(await hasPersonalRecovery()).toBe(true);
  });
});
