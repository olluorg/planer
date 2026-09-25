import { test, expect } from '@playwright/test';

/** Сценарий целиком: цель со сроком, темп ниже нужного → карточка в
 *  уведомлениях. Интерфейс всегда пишет отметку «сегодня», поэтому между
 *  отметками переводим часы браузера на день вперёд. */
test('отстающая цель присылает «не успевает к сроку»', async ({ page }) => {
  const day1 = new Date('2026-10-01T10:00:00');
  await page.clock.install({ time: day1 });
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/goals');

  await page.getByRole('button', { name: 'Новая цель' }).first().click();
  await page.getByPlaceholder('Название').fill('Марафон');
  await page.getByPlaceholder('Старт').fill('0');
  await page.getByPlaceholder('Цель', { exact: true }).fill('100');
  await page.getByPlaceholder('Ед.').fill('км');
  await page.locator('input[type="date"]').fill('2026-11-01');
  await page.getByRole('button', { name: 'Создать' }).click();

  const mark = async (v: string) => {
    await page.getByPlaceholder(/^Текущее значение/).fill(v);
    await page.getByRole('button', { name: 'Записать' }).click();
  };
  await mark('10');
  await page.clock.setSystemTime(new Date('2026-10-02T10:00:00'));
  await mark('11'); // 1 км/день, осталось 89 за 30 дней → к сроку ~41

  await page.getByRole('button', { name: 'Уведомления и инсайты' }).click();
  await expect(page.getByText('«Марафон» не успевает к сроку')).toBeVisible();
  await expect(page.getByText(/Уменьшить цель до 41/)).toBeVisible();
});
