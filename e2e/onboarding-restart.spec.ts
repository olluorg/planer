import { test, expect } from '@playwright/test';

test('restarting onboarding preserves the current screen when storage fails', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/settings');
  await expect(page.getByRole('button', { name: 'Пройти знакомство заново' })).toBeVisible();
  await page.evaluate(() => {
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === 'readwrite') throw new Error('test storage failure');
      return original.apply(this, args);
    };
  });
  await page.getByRole('button', { name: 'Пройти знакомство заново' }).click();
  await expect(page.getByText('Не удалось открыть знакомство')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('onboarding.done.v1'))).toBe('1');
  await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
});
