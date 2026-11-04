import { test, expect, chromium } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';

test('packaged extension persists a task and schedules updated reminders', async () => {
  test.skip(process.env.EXTENSION_E2E !== '1', 'Requires an extension build in dist');
  const profile = await mkdtemp(path.join(tmpdir(), 'thedad-extension-test-'));
  const extension = path.resolve('dist');
  const context = await chromium.launchPersistentContext(profile, {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  try {
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    const extensionId = new URL(worker.url()).host;
    const page = await context.newPage();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await page.evaluate(() => localStorage.setItem('onboarding.done.v1', '1'));
    await page.reload();
    await page.goto(`chrome-extension://${extensionId}/index.html`);
    await page.getByRole('link', { name: 'Задачи', exact: true }).first().click();
    const task = page.getByPlaceholder('Новая задача...');
    await task.fill('Задача расширения');
    await task.press('Enter');
    await expect(page.getByText('Задача расширения', { exact: true })).toBeVisible();
    await expect.poll(() => page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const value = await new Promise<Uint8Array>((resolve, reject) => {
        const request = db.transaction('keyval').objectStore('keyval').get('thedad.sqlite.v1');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return value && new TextDecoder().decode(value).includes('Задача расширения');
    })).toBe(true);
    await page.reload();
    await expect(page.getByText('Задача расширения', { exact: true })).toBeVisible();
    const result = await page.evaluate(async () => {
      const chromeApi = (globalThis as any).chrome;
      await chromeApi.storage.local.set({ planer_reminders: [{ id: 'test', text: 'Напоминание', time: '10:15', enabled: true }] });
      return chromeApi.runtime.sendMessage({ type: 'reschedule' });
    });
    expect(result).toEqual({ ok: true });
    const alarm = await worker.evaluate(async () => (globalThis as any).chrome.alarms.get('custom-test'));
    expect(alarm?.name).toBe('custom-test');
    await page.evaluate(async () => {
      const chromeApi = (globalThis as any).chrome;
      await chromeApi.storage.local.set({ planer_reminders: [] });
      await chromeApi.runtime.sendMessage({ type: 'reschedule' });
    });
    expect(await worker.evaluate(async () => (globalThis as any).chrome.alarms.get('custom-test'))).toBeUndefined();
  } finally {
    await context.close();
    await rm(profile, { recursive: true, force: true });
  }
});
