import { test, expect } from '@playwright/test';

test('habits remain usable on a narrow screen and month marks have accessible state', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('theme', 'work');
  });
  await page.goto('/habits');
  await page.getByLabel('Дней в неделю для новой привычки').selectOption('3');
  await page.getByPlaceholder('Новая привычка...').fill('Прогулка');
  await page.getByPlaceholder('Новая привычка...').press('Enter');
  const target = page.getByLabel('Дней в неделю: Прогулка');
  await expect(target).toHaveValue('3');
  await target.selectOption('5');
  await page.reload();
  await expect(target).toHaveValue('5');
  const habitRow = page.locator('.group').filter({ hasText: 'Прогулка' });
  await expect(habitRow.locator('svg').first()).toHaveCSS('color', 'rgb(64, 94, 74)');
  const remove = page.getByRole('button', { name: 'Удалить привычку: Прогулка' });
  await expect(remove).toBeVisible();
  const table = page.locator('.overflow-x-auto').first();
  if (page.viewportSize()!.width < 520) {
    expect(await table.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
    await expect(remove).toHaveCSS('opacity', '1');
  }
  await page.getByRole('tab', { name: 'Месяц' }).click();
  await expect(page.locator('tr').filter({ hasText: 'Прогулка' }).locator('td span').first()).toHaveCSS('background-color', 'rgb(64, 94, 74)');
  const mark = page.getByRole('button', { name: /^Прогулка,/ }).last();
  await expect(mark).toHaveAttribute('aria-pressed', 'false');
  await mark.click();
  await expect(mark).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await page.getByRole('tab', { name: 'Месяц' }).click();
  await expect(page.getByRole('button', { name: /^Прогулка,/ }).last()).toHaveAttribute('aria-pressed', 'true');
});
