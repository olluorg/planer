import { test, expect } from '@playwright/test';

test('failed QR import preserves the existing connection and reports the error', async ({ page }) => {
  const key = Buffer.alloc(32, 7).toString('base64');
  const previous = { serverUrl: 'https://previous.invalid', syncId: 'old', authToken: 'old-token', encKey: key };
  const payload = Buffer.from(JSON.stringify({ s: 'https://offline.invalid', i: 'new', t: 'new-token', k: key })).toString('base64url');
  await page.addInitScript((config) => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('thedad.sync.v1', JSON.stringify(config));
  }, previous);
  await page.route('https://offline.invalid/**', route => route.abort('failed'));
  await page.goto(`/?keep=1#sync=${payload}`);
  await expect(page.getByText('Не удалось подключить устройство')).toBeVisible();
  await expect.poll(() => page.evaluate(() => location.hash)).toBe('');
  expect(await page.evaluate(() => location.search)).toBe('?keep=1');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('thedad.sync.v1')!))).toEqual(previous);
});
