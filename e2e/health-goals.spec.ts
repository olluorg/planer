import { test, expect } from '@playwright/test';

test('health metric updates a linked goal without duplicate daily records', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1','1'));
  await page.goto('/goals');
  await page.getByRole('button', {name:'Новая цель'}).first().click();
  const dialog = page.getByRole('dialog', {name:'Новая цель'});
  await dialog.getByPlaceholder('Название').fill('Ходьба каждый день');
  await dialog.getByPlaceholder('Старт').fill('0');
  await dialog.getByPlaceholder('Цель', {exact:true}).fill('10000');
  await dialog.getByText('Без авто-прогресса').click();
  await page.getByRole('option', {name:'Шаги', exact:true}).click();
  await dialog.getByRole('button', {name:'Создать', exact:true}).click();
  await expect(dialog).toHaveCount(0);
  await page.goto('/health');
  const steps = page.getByPlaceholder('значение', {exact:true});
  await steps.fill('4000');
  await steps.press('Enter');
  await steps.fill('6000');
  await steps.press('Enter');
  await page.goto('/goals');
  await expect(page.getByText('Ходьба каждый день').first()).toBeVisible();
  await expect(page.getByText(/6[\s\u00a0]?000/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText(/6[\s\u00a0]?000/).first()).toBeVisible();
});
