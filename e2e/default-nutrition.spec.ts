import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('default nutrition library retries after a temporary loading failure', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.route('**/plugins/nutrition-month.thedad-widget.json', route => route.fulfill({ status: 503, body: '' }));
  const failed = page.waitForResponse(response => response.url().includes('/plugins/nutrition-month.thedad-widget.json'));
  await page.goto('/');
  expect((await failed).status()).toBe(503);
  expect(await page.evaluate(() => localStorage.getItem('plugins.defaults.v4'))).toBeNull();
  await page.unroute('**/plugins/nutrition-month.thedad-widget.json');
  await page.reload();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('plugins.defaults.v4'))).toBe('1');
  const ids = await page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1') || '[]').map((p: {id: string}) => p.id));
  expect(ids).toContain('nutrition-month');
});

test('damaged plugin data is preserved and can be downloaded for recovery', async ({ page }) => {
  const raw = '{"broken":';
  await page.addInitScript(value => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('plugins.installed.v1', value);
  }, raw);
  await page.goto('/settings');
  await expect(page.getByRole('alert').filter({ hasText: 'Данные виджетов повреждены' })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать исходную копию' }).click();
  const download = await downloadPromise;
  expect(await fs.readFile((await download.path())!, 'utf8')).toBe(raw);
  expect(await page.evaluate(() => localStorage.getItem('plugins.installed.v1'))).toBe(raw);
  expect(await page.evaluate(() => localStorage.getItem('plugins.defaults.v4'))).toBeNull();
});

test('a missing built-in nutrition plan can be restored from settings', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('plugins.defaults.v4', '1');
  });
  await page.goto('/settings');
  const restore = page.getByRole('button', { name: 'Восстановить встроенный план питания' });
  await expect(restore).toBeVisible();
  await restore.click();
  await expect(page.getByText('Встроенный план питания добавлен')).toBeVisible();
  await expect(restore).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Правильное питание на месяц', { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1') || '[]').filter((p: {id: string}) => p.id === 'nutrition-month').length)).toBe(1);
});
