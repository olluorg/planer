import { test, expect } from '@playwright/test';

test('знакомство: за три шага от нуля до цели с первой точкой', async ({ page }) => {
  await page.goto('/');
  const dlg = page.getByRole('dialog', { name: 'Знакомство с THEDAD' });
  await expect(dlg).toBeVisible();

  await dlg.getByPlaceholder('Имя').fill('Аня');
  await dlg.getByRole('button', { name: 'Дальше' }).click();

  // Нельзя создать «цель» без чисел.
  await expect(dlg.getByRole('button', { name: 'Создать цель' })).toBeDisabled();
  await dlg.getByLabel('Цель', { exact: true }).fill('Пробежать 10 км');
  await dlg.getByLabel('Сейчас').fill('3');
  await dlg.getByLabel('Нужно').fill('10');
  await dlg.getByLabel('Единица').fill('км');
  await dlg.getByRole('button', { name: 'Создать цель' }).click();

  await expect(dlg.getByText('Первая отметка')).toBeVisible();
  await dlg.getByLabel(/^Сейчас/).fill('4');
  await dlg.getByRole('button', { name: 'Готово' }).click();
  await expect(dlg).toBeHidden();

  // Цель на месте, первая точка стоит, и приложение говорит, чего ждать дальше.
  await page.goto('/goals');
  await expect(page.getByText('Пробежать 10 км').first()).toBeVisible();
  await expect(page.getByText(/Ещё одна отметка в другой день/)).toBeVisible();
  // После перезагрузки мастер не возвращается.
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Знакомство с THEDAD' })).toHaveCount(0);
});

test('знакомство можно пропустить — приложение открывается пустым', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByRole('dialog', { name: 'Знакомство с THEDAD' })).toHaveCount(0);
});
