import { createCipheriv, randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { DEFAULT_LAYOUT } from '../src/lib/dashboardPresets';

test('a day without content is not presented as a completed rest day', async ({ page }) => {
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const pack = { schema: 'thedad.program/v1', id: 'empty-program', title: 'Программа', emoji: '🎯', duration_days: 1, days: [] };
  const ct = Buffer.concat([cipher.update(JSON.stringify(pack)), cipher.final(), cipher.getAuthTag()]);
  await page.addInitScript((key64) => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('marketplace.licenses.v1', JSON.stringify({ 'empty-program': key64 }));
  }, key.toString('base64'));
  await page.route('**/marketplace/empty-program.pack', route => route.fulfill({ json: { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64') } }));
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:program-open', { detail: { id: 'empty-program' } })));
  await expect(page.getByText('Для этого дня материалы пока не добавлены.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отметить день выполненным' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('program.progress.v1'))).toBeNull();
});

test('meal cards explain when nutritional values are missing', async ({ page }) => {
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const pack = { schema: 'thedad.program/v1', id: 'meal-program', title: 'Программа', emoji: '🎯', duration_days: 1, days: [{ day: 1, meals: [{ meal: 'Обед', title: 'Пример блюда', recipe: 'Рецепт' }, { meal: 'Завтрак', title: 'Каша', recipe: 'Рецепт каши', kcal: 344, protein: 9.2, fat: 10.1, carbs: 58.1 }] }] };
  const ct = Buffer.concat([cipher.update(JSON.stringify(pack)), cipher.final(), cipher.getAuthTag()]);
  await page.addInitScript((key64) => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('marketplace.licenses.v1', JSON.stringify({ 'meal-program': key64 }));
  }, key.toString('base64'));
  await page.route('**/marketplace/meal-program.pack', route => route.fulfill({ json: { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64') } }));
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:program-open', { detail: { id: 'meal-program' } })));
  await expect(page.getByText('КБЖУ не рассчитаны')).toBeVisible();
  await expect(page.getByText('Пример блюда')).toBeVisible();
  await expect(page.getByText('Б 9.2 · Ж 10.1 · У 58.1 г')).toBeVisible();
  await page.getByRole('button', { name: /Каша/ }).click();
  await page.getByRole('button', { name: 'Отметить съеденным сегодня' }).click();
  let entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toContainEqual(expect.objectContaining({ key: 'Завтрак¦Каша', kcal: 344, protein: 9.2, fat: 10.1, carbs: 58.1 }));
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('nutrition.eaten.v1')!);
    const day = Object.values(store)[0] as Array<{ kcal: number }>;
    day[0].kcal = 500;
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
  });
  await expect(page.getByText(/другим КБЖУ/)).toBeVisible();
  await page.getByRole('button', { name: 'Отметить съеденным сегодня' }).click();
  entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'Завтрак¦Каша', kcal: 500 }), expect.objectContaining({ kcal: 344, title: 'Каша' })]));
  await page.getByRole('button', { name: 'Снять отметку за сегодня' }).click();
  entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toEqual([expect.objectContaining({ key: 'Завтрак¦Каша', kcal: 500 })]);
  await page.evaluate(() => {
    const store = JSON.parse(localStorage.getItem('nutrition.eaten.v1')!);
    const day = Object.values(store)[0] as Array<{ kcal: number }>;
    day[0].kcal = 344;
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify(store));
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
  });
  await page.getByRole('button', { name: /Пример блюда/ }).click();
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'nutrition.eaten.v1') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', { name: 'Отметить съеденным сегодня' }).click();
  await expect(page.getByText('Изменения питания не сохранены', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отметить съеденным сегодня' })).toHaveAttribute('aria-pressed', 'false');
  entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toHaveLength(1);
  await page.reload();
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:program-open', { detail: { id: 'meal-program' } })));
  await page.getByRole('button', { name: /Пример блюда/ }).click();
  await page.getByRole('button', { name: 'Отметить съеденным сегодня' }).click();
  entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toContainEqual({ key: 'Обед¦Пример блюда', title: 'Пример блюда', meal: 'Обед' });
  await page.getByRole('button', { name: 'Снять отметку за сегодня' }).last().click();
  await page.evaluate((ids) => {
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{ id: 'calories-test', name: 'Калории', hidden: ids.filter((id: string) => id !== 'calories'), layout: [{ i: 'calories', x: 0, y: 0, w: 6, h: 8 }] }]));
    localStorage.setItem('dashboard.activeScreen.v1', 'calories-test');
  }, DEFAULT_LAYOUT.map(l => l.i));
  await page.goto('/settings');
  await page.getByRole('button', { name: /Загрузить примеры/ }).click();
  await page.goto('/');
  await expect(page.getByText('344', { exact: true })).toBeVisible();
});
