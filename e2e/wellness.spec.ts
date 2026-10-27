import { test, expect } from '@playwright/test';
import { DEFAULT_LAYOUT } from '../src/lib/dashboardPresets';
import fs from 'node:fs';

test.beforeEach(async ({ page }) => {
  const plugin = JSON.parse(fs.readFileSync('public/plugins/nutrition-month.thedad-widget.json', 'utf8'));
  Object.assign(plugin.source.static[0], { protein: 20, fat: 0, carbs: 35 });
  await page.addInitScript(({ plugin, ids }) => {
    localStorage.setItem('onboarding.done.v1', '1');
    if (localStorage.getItem('wellness.fixture')) return;
    localStorage.setItem('wellness.fixture', '1');
    localStorage.setItem('plugins.defaults.v4', '1');
    localStorage.setItem('plugins.installed.v1', JSON.stringify([plugin]));
    localStorage.setItem('workout.type.v1', 'obsolete-type');
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{ id: 'wellness', name: 'Wellness', hidden: ids.filter((id: string) => id !== 'workout'), layout: [
      { i: 'workout', x: 0, y: 0, w: 4, h: 6 },
      { i: 'plugin:nutrition-month', x: 4, y: 0, w: 8, h: 8 },
    ] }]));
    localStorage.setItem('dashboard.activeScreen.v1', 'wellness');
  }, { plugin, ids: DEFAULT_LAYOUT.map((l) => l.i) });
  await page.goto('/settings');
  await page.getByRole('button', { name: /Загрузить примеры/ }).click();
});

test('recipe eaten toggle stores macros and updates immediately', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  await page.getByRole('button', { name: 'Рецепт: Овсянка с бананом', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: 'Овсянка с бананом', exact: true });
  await expect(recipe.getByText('Жиры', { exact: true })).toBeVisible();
  await recipe.getByRole('button', { name: 'Отметить съеденным', exact: true }).click();
  await expect(recipe.getByRole('button', { name: 'Съедено — учтено', exact: true })).toBeVisible();
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toEqual([expect.objectContaining({ protein: 20, fat: 0, carbs: 35 })]);
  await recipe.getByRole('button', { name: 'Съедено — учтено', exact: true }).click();
  await expect(recipe.getByRole('button', { name: 'Отметить съеденным', exact: true })).toBeVisible();
});

test('new workout has seven real images and supports start, pause and next', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать тренировку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Тренировка', exact: true });
  await expect(dialog.getByRole('button', { name: 'Без прыжков', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('img', { name: 'Шаг на месте', exact: true })).toBeVisible();
  await dialog.locator('summary').click();
  await expect(dialog.getByRole('list', { name: 'Упражнения до старта' }).locator('li')).toHaveCount(7);
  await dialog.getByRole('button', { name: 'Начать · Без прыжков', exact: true }).click();
  await page.waitForTimeout(1200); // let the workout record real elapsed time before pausing
  await dialog.getByRole('button', { name: 'Пауза', exact: true }).click();
  for (const name of ['Шаг на месте', 'Приседания', 'Подъём на носки', 'Ягодичный мостик', 'Птица-собака', 'Планка', 'Поза ребёнка']) {
    const img = dialog.getByRole('img', { name, exact: true });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await dialog.getByRole('button', { name: 'Пропустить упражнение' }).click();
  }
  await expect(dialog.getByText('Без прыжков — готово!', { exact: true })).toBeVisible();
});

test('new recipe can be previewed, added and preserved without overwriting the existing plan', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  const planner = page.getByRole('dialog', { name: 'Конструктор рациона', exact: true });
  await expect(planner.getByLabel('Питание за день 1', { exact: true })).toContainText('Частичный итог');
  await planner.getByLabel('Подобрать под свой день').selectOption('quick');
  await expect(planner.getByRole('button', { name: /^Выбрать блюдо:/ })).toHaveCount(2);
  await planner.getByLabel('Подобрать под свой день').selectOption('all');
  await planner.getByRole('button', { name: 'Новая коллекция · 4 блюда' }).click();
  await expect(planner.getByRole('button', { name: /^Выбрать блюдо:/ })).toHaveCount(4);
  await planner.getByRole('button', { name: 'Рецепт: Овсянка с бананом и орехами', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: 'Овсянка с бананом и орехами', exact: true });
  const img = recipe.getByRole('img', { name: 'Овсянка с бананом и орехами', exact: true });
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(recipe.getByText(/Ингредиенты:/)).toBeVisible();
  await recipe.getByRole('button', { name: 'Закрыть (Esc)', exact: true }).click();
  await planner.getByRole('button', { name: 'Выбрать блюдо: Овсянка с бананом и орехами', exact: true }).click();
  await planner.locator('tbody tr').first().locator('td').nth(1).click();
  await planner.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1')!)[0].source.static);
  expect(saved.some((r: any) => r.day === 1 && r.title === 'Овсянка с бананом и орехами')).toBe(true);
  expect(saved.some((r: any) => r.day === 1 && r.title === 'Овсянка с бананом')).toBe(true);
  await page.getByTitle('Открыть конструктор рациона').click();
  await planner.getByRole('button', { name: 'Новая коллекция · 4 блюда' }).click();
  await expect(planner.getByRole('button', { name: /^Выбрать блюдо:/ })).toHaveCount(4);
});

test('a missing recipe photo does not leave a broken image or hide the recipe', async ({ page }) => {
  await page.route('**/food/studio/salmon-asparagus.webp', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  await page.getByRole('button', { name: 'Новая коллекция · 4 блюда' }).click();
  await page.getByRole('button', { name: 'Рецепт: Лосось со спаржей', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: 'Лосось со спаржей', exact: true });
  await expect(recipe.getByText('Фото не добавлено', { exact: true })).toBeVisible();
  await expect(recipe.locator('img')).toHaveCount(0);
  await expect(recipe.getByText(/Ингредиенты:/)).toBeVisible();
});
