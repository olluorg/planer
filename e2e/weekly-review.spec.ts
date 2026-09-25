import { test, expect } from '@playwright/test';

test('обзор недели: приглашение в воскресенье, перенос хвостов, главное на понедельник', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-27T18:00:00') }); // воскресенье
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/settings');
  await page.getByRole('button', { name: /Загрузить примеры/ }).click();
  await page.goto('/');

  // Приглашение пришло и ведёт в обзор.
  await page.getByRole('button', { name: 'Уведомления и инсайты' }).click();
  await page.getByText('Время обзора недели').click();
  const dlg = page.getByRole('dialog', { name: 'Обзор недели' });
  await expect(dlg).toBeVisible();

  // Шаг 1: у каждой цели есть оценка темпа.
  await expect(dlg.getByText(/опережаете|в графике|отстаёте|без движения|нет отметок/).first()).toBeVisible();
  await dlg.getByRole('button', { name: 'Дальше' }).click();

  // Шаг 2: задачи недели и перенос незакрытого.
  await expect(dlg.getByText(/Выполнено задач/)).toBeVisible();
  const move = dlg.getByRole('button', { name: /Перенести на понедельник/ });
  if (await move.count()) {
    await move.click();
    await expect(dlg.getByRole('button', { name: 'Перенесено' })).toBeVisible();
  }
  await dlg.getByRole('button', { name: 'Дальше' }).click();
  await dlg.getByRole('button', { name: 'Дальше' }).click();

  // Шаг 4: главное на следующую неделю → задача на понедельник.
  await dlg.getByLabel('Главное №1').fill('Сдать отчёт');
  await dlg.getByRole('button', { name: 'Завершить обзор' }).click();
  await expect(dlg).toBeHidden();

  await page.clock.setSystemTime(new Date('2026-09-28T09:00:00')); // понедельник
  await page.goto('/tasks');
  await expect(page.getByText('Сдать отчёт').first()).toBeVisible();
});
