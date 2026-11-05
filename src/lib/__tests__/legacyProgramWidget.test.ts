// @vitest-environment happy-dom
import { beforeEach, expect, it } from 'vitest';
import legacy from '../legacyWeightLossWidget.json';
import { getInstalledPlugins, installPlugin, migrateLegacyWeightLossWidget, validatePlugin } from '../plugins';

beforeEach(() => localStorage.clear());

it('removes uncalculated calories only from the unmodified old widget', () => {
  const original = validatePlugin(legacy);
  if (!original.ok) throw new Error('Invalid fixture');
  localStorage.setItem('plugins.installed.v1', JSON.stringify([original.plugin]));
  expect(migrateLegacyWeightLossWidget()).toBe(true);
  const widget = getInstalledPlugins()[0];
  expect(widget.name).toBe('Идеи блюд на неделю');
  expect(widget.render.badge).toBe('{{meal}}');
  expect(widget.source.static?.every(row => !('kcal' in row))).toBe(true);
  expect(migrateLegacyWeightLossWidget()).toBe(false);
});

it('updates the exact legacy widget immediately when it is imported', () => {
  const installed = installPlugin(legacy);
  expect(installed.name).toBe('Идеи блюд на неделю');
  expect(installed.source.static?.every(row => !('kcal' in row))).toBe(true);
});

it('leaves a user-modified widget and other data unchanged', () => {
  installPlugin({ ...legacy, name: 'Мой план' });
  const before = localStorage.getItem('plugins.installed.v1');
  expect(migrateLegacyWeightLossWidget()).toBe(false);
  expect(localStorage.getItem('plugins.installed.v1')).toBe(before);
});

it('does not recreate a removed widget or overwrite damaged storage', () => {
  expect(migrateLegacyWeightLossWidget()).toBe(false);
  localStorage.setItem('plugins.installed.v1', '{broken');
  expect(() => migrateLegacyWeightLossWidget()).toThrow('повреждено');
  expect(localStorage.getItem('plugins.installed.v1')).toBe('{broken');
});
