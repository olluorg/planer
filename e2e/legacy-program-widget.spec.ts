import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('an unchanged old program widget is updated on startup', async ({ page }) => {
  const raw = JSON.parse(readFileSync('src/lib/legacyWeightLossWidget.json', 'utf8'));
  const widget = { schema: raw.schema, id: raw.id, name: raw.name, author: raw.author, icon: raw.icon, defaultSize: raw.defaultSize, source: raw.source,
    render: { type: raw.render.type, label: raw.render.label, detail: raw.render.detail, badge: raw.render.badge, dayField: raw.render.dayField } };
  await page.addInitScript((widget) => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('plugins.defaults.v4', '1');
    localStorage.setItem('plugins.installed.v1', JSON.stringify([widget]));
  }, widget);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1') ?? '[]')[0]?.name)).toBe('Идеи блюд на неделю');
  const data = await page.evaluate(() => localStorage.getItem('plugins.installed.v1'));
  expect(data).not.toContain('"kcal"');
});
