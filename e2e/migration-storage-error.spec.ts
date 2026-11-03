import { test, expect } from '@playwright/test';

test('failed migration backup shows an actionable error and leaves data for retry', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    if (sessionStorage.getItem('fail-migration-backup') !== '1') return;
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(value: unknown, key?: IDBValidKey) {
      if (typeof key === 'string' && key.startsWith('thedad.backup.')) throw new DOMException('full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
  });
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Не потерять задачу');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await expect(page.getByText('Не потерять задачу').first()).toBeVisible();
  await page.waitForTimeout(500);
  await page.evaluate(async () => {
    const request = indexedDB.open('keyval-store');
    const db = await new Promise<IDBDatabase>((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('keyval', 'readwrite');
      const store = tx.objectStore('keyval');
      const get = store.get('thedad.sqlite.v1');
      get.onsuccess = () => {
        const data = new Uint8Array(get.result);
        data[60] = 0; data[61] = 0; data[62] = 0; data[63] = 2;
        store.put(data, 'thedad.sqlite.v1');
      };
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error);
    });
    db.close();
    sessionStorage.setItem('fail-migration-backup', '1');
  });
  await page.reload();
  await expect(page.getByText('Не удалось открыть базу данных')).toBeVisible();
  await expect(page.getByText(/Не удалось сохранить копию базы перед обновлением/)).toBeVisible();
  await expect(page.getByText(/Обновите приложение до последней версии/)).toHaveCount(0);
  await page.evaluate(() => sessionStorage.removeItem('fail-migration-backup'));
  await page.getByRole('button', {name:'Перезагрузить'}).click();
  await page.goto('/tasks');
  await expect(page.getByText('Не потерять задачу').first()).toBeVisible();
});
