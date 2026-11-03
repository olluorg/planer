// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureDefaultPlugins, getInstalledPlugins, installPlugin, removePlugin, isPluginStorageReadable } from '../plugins';

const fixture = JSON.parse(readFileSync('public/plugins/nutrition-month.thedad-widget.json', 'utf8'));

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('default nutrition plugin installation', () => {
  it('retries after a failed request and installs on the next attempt', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(fixture), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    await ensureDefaultPlugins();
    expect(localStorage.getItem('plugins.defaults.v4')).toBeNull();
    expect(getInstalledPlugins()).toHaveLength(0);
    await ensureDefaultPlugins();
    expect(getInstalledPlugins().map(p => p.id)).toEqual(['nutrition-month']);
    expect(localStorage.getItem('plugins.defaults.v4')).toBe('1');
  });

  it('preserves an existing custom plan instead of reinstalling it', async () => {
    const custom = structuredClone(fixture);
    custom.name = 'Моё питание';
    installPlugin(custom);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await ensureDefaultPlugins();
    expect(getInstalledPlugins()[0].name).toBe('Моё питание');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('plugins.defaults.v4')).toBe('1');
  });

  it('does not reinstall a plan deliberately removed after setup', async () => {
    installPlugin(fixture);
    localStorage.setItem('plugins.defaults.v4', '1');
    removePlugin('nutrition-month');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await ensureDefaultPlugins();
    expect(getInstalledPlugins()).toHaveLength(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not mark a malformed or unexpected response as installed', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: 'other' }), { status: 200 })));
    await ensureDefaultPlugins();
    expect(getInstalledPlugins()).toHaveLength(0);
    expect(localStorage.getItem('plugins.defaults.v4')).toBeNull();
  });

  it.each(['{broken', JSON.stringify([fixture, { id: 'partial' }])])('does not overwrite damaged plugin data', async (raw) => {
    localStorage.setItem('plugins.installed.v1', raw);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    expect(isPluginStorageReadable()).toBe(false);
    expect(() => installPlugin(fixture)).toThrow(/повреждено/);
    expect(() => removePlugin('nutrition-month')).toThrow(/повреждено/);
    await ensureDefaultPlugins();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(localStorage.getItem('plugins.installed.v1')).toBe(raw);
    expect(localStorage.getItem('plugins.defaults.v4')).toBeNull();
  });
});
