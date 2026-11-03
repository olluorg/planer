import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('failed background save offers a recoverable copy and retry', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      if (key === 'thedad.sqlite.v1' && sessionStorage.getItem('fail-write') === '1') {
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return original.call(this, value, key);
    };
  });
  await page.goto('/tasks');
  await expect(page.getByPlaceholder('Новая задача...')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('fail-write', '1'));
  await page.getByPlaceholder('Новая задача...').fill('Задача в памяти');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  const warning = page.getByRole('alert').filter({ hasText: 'Не удалось сохранить изменения на устройстве' });
  await expect(warning).toBeVisible();
  const pendingDownload = page.waitForEvent('download');
  await warning.getByRole('button', { name: 'Скачать текущую базу' }).click();
  const download = await pendingDownload;
  const bytes = await fs.readFile((await download.path())!);
  expect(bytes.subarray(0, 16).toString()).toBe('SQLite format 3\0');
  expect(bytes.includes(Buffer.from('Задача в памяти'))).toBe(true);
  await page.evaluate(() => sessionStorage.removeItem('fail-write'));
  await warning.getByRole('button', { name: 'Повторить сохранение' }).click();
  await expect(warning).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Задача в памяти', { exact: true })).toBeVisible();
});

test('reload warns while a database write is still in progress', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      const result = original.call(this, value, key);
      if (key === 'thedad.sqlite.v1' && sessionStorage.getItem('hold-write') === '1') {
        sessionStorage.setItem('write-held', '1');
        const store = this;
        const keepAlive = () => {
          if (sessionStorage.getItem('hold-write') !== '1') return;
          const request = store.get('thedad.sqlite.v1');
          request.onsuccess = keepAlive;
        };
        keepAlive();
      }
      return result;
    };
  });
  await page.goto('/tasks');
  await expect(page.getByPlaceholder('Новая задача...')).toBeVisible();
  await page.evaluate(() => sessionStorage.setItem('hold-write', '1'));
  await page.getByPlaceholder('Новая задача...').fill('Не закрывать до записи');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('write-held'))).toBe('1');
  const dialogPromise = page.waitForEvent('dialog');
  const reload = page.reload({ timeout: 2000 }).catch(() => null);
  const dialog = await dialogPromise;
  expect(dialog.type()).toBe('beforeunload');
  await dialog.dismiss();
  await page.evaluate(() => sessionStorage.removeItem('hold-write'));
  await reload;
  await page.evaluate(async () => {
    const open = indexedDB.open('keyval-store');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keyval', 'readonly');
      tx.objectStore('keyval').get('thedad.sqlite.v1');
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
  await page.reload();
  await expect(page.getByText('Не закрывать до записи', { exact: true })).toBeVisible();
});
