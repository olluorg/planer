import { writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';

test.use({ serviceWorkers: 'allow' });

test.beforeAll(async () => {
  // Test-only worker lives in ignored dist, not in the shipped public assets.
  await writeFile('dist/test-update-worker.js', `
self.addEventListener('install', () => {});
self.addEventListener('message', event => { if (event.data?.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
`);
});

test('update waits for storage and can be retried after an error', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/tasks');
  await expect(page.getByPlaceholder('Новая задача...')).toBeVisible();
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  await page.evaluate(() => {
    (window as any).__updateTestMarker = 'same-page';
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if ((window as any).__failUpdateWrite && args[1] === 'readwrite') throw new Error('test storage failure');
      return original.apply(this, args);
    };
  });
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/test-update-worker.js', { scope: '/' });
  });
  const update = page.getByRole('button', { name: 'Обновить', exact: true });
  await expect(update).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { (window as any).__failUpdateWrite = true; });
  await update.click();
  await expect(page.getByText('Не удалось обновить приложение')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__updateTestMarker)).toBe('same-page');
  await page.evaluate(() => { (window as any).__failUpdateWrite = false; });
  const navigation = page.waitForEvent('load');
  await page.getByRole('button', { name: 'Повторить', exact: true }).last().click();
  await navigation;
  await expect(page.getByPlaceholder('Новая задача...')).toBeVisible();
  expect(await page.evaluate(() => (window as any).__updateTestMarker ?? null)).toBeNull();
});
