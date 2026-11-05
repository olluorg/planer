import { test, expect } from '@playwright/test';
import path from 'node:path';

test('переезд из Google Tasks: превью, импорт, подзадачи на месте', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/settings');
  await page.locator('input[type="file"][accept=".csv,.json,text/csv,application/json"]')
    .setInputFiles(path.resolve('e2e/fixtures/google-tasks.json'));

  const dlg = page.getByRole('dialog', { name: /Импорт из Google Tasks/ });
  await expect(dlg).toBeVisible();
  await expect(dlg.getByText('Найдено задач: 2 активных, 1 выполненных.')).toBeVisible();
  await dlg.getByRole('button', { name: 'Импортировать 2' }).click();
  await expect(dlg).toBeHidden();
  await expect(page.getByText('Импортировано задач: 2')).toBeVisible();

  // Перед импортом снят снимок — откатиться есть куда.
  await expect(page.getByText(/Перед импортом файла/).first()).toBeVisible();

  await page.goto('/tasks');
  await expect(page.getByText('Позвонить маме').first()).toBeVisible();
});

test('импорт не начинается, если снимок базы не удалось создать', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/settings');
  await page.locator('input[type="file"][accept=".csv,.json,text/csv,application/json"]')
    .setInputFiles(path.resolve('e2e/fixtures/google-tasks.json'));
  const dlg = page.getByRole('dialog', { name: /Импорт из Google Tasks/ });
  await expect(dlg).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (typeof key === 'string' && key.startsWith('thedad.backup.')) throw new Error('test backup failure');
      return original.call(this, value, key);
    };
  });
  await dlg.getByRole('button', { name: 'Импортировать 2' }).click();
  await expect(page.getByText('Не удалось импортировать задачи')).toBeVisible();
  await expect(dlg).toBeVisible();
  await dlg.getByRole('button', { name: 'Отмена' }).click();
  await page.goto('/tasks');
  await expect(page.getByText('Позвонить маме')).toHaveCount(0);
});
