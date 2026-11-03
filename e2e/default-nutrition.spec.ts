import { test, expect } from '@playwright/test';

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
