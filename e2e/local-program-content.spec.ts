import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('the published local program displays its documented meals', async ({ page }) => {
  test.skip(!existsSync('secrets/pack-keys.json'), 'Requires the local program key; not part of CI');
  const key = JSON.parse(readFileSync('secrets/pack-keys.json', 'utf8'))['weight-loss-8w'];
  test.skip(typeof key !== 'string', 'Local key for this program is unavailable');
  await page.addInitScript((contentKey) => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('marketplace.licenses.v1', JSON.stringify({ 'weight-loss-8w': contentKey }));
  }, key);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:program-open', { detail: { id: 'weight-loss-8w' } })));
  const firstBreakfast = page.getByRole('button', { name: /Овсянка с бананом и орехами/ });
  await expect(firstBreakfast).toHaveAttribute('aria-expanded', 'false');
  await firstBreakfast.click();
  await expect(firstBreakfast).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Отметить съеденным сегодня' }).click();
  await expect(page.getByRole('button', { name: 'Снять отметку за сегодня' })).toHaveAttribute('aria-pressed', 'true');
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toContainEqual(expect.objectContaining({ key: 'Завтрак¦Овсянка с бананом и орехами', kcal: 344, protein: 9.2, fat: 10.1, carbs: 58.1 }));
  await page.reload();
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:program-open', { detail: { id: 'weight-loss-8w' } })));
  await firstBreakfast.click();
  await page.getByRole('button', { name: 'Снять отметку за сегодня' }).click();
  await expect(page.getByRole('button', { name: 'Отметить съеденным сегодня' })).toHaveAttribute('aria-pressed', 'false');
  await page.getByRole('button', { name: 'Следующий день' }).click();
  await expect(page.getByRole('button', { name: /Омлет со шпинатом и томатами/ })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Предыдущий день' }).click();
  await expect(firstBreakfast).toHaveAttribute('aria-expanded', 'false');
  const pack = JSON.parse(readFileSync('content/programs/weight-loss-8w.json', 'utf8')) as {
    days: Array<{ day: number; title: string; workout?: { title: string; exercises?: Array<{ name: string }> }; meals?: Array<{ title: string; kcal?: number; protein: number; fat: number; carbs: number; photo: string }> }>;
  };
  let checked = 0;
  for (const day of pack.days.slice(0, 14)) {
    await expect(page.getByText(day.title, { exact: true })).toBeVisible();
    await expect(page.getByText(/не полный рацион или индивидуальная норма на день/)).toBeVisible();
    if (day.workout) {
      await expect(page.getByText(day.workout.title, { exact: true })).toBeVisible();
      for (const exercise of day.workout.exercises ?? []) await expect(page.getByText(exercise.name, { exact: true })).toBeVisible();
    }
    for (const entry of day.meals ?? []) {
      if (entry.kcal === undefined) continue;
      const meal = page.getByRole('button', { name: entry.title });
      await expect(meal).toBeVisible();
      await expect(meal).toContainText(`${entry.kcal} ккал`);
      await expect(meal).toContainText(`Б ${entry.protein} · Ж ${entry.fat} · У ${entry.carbs} г`);
      if (entry.photo) {
        const image = meal.locator('img');
        await expect(image).toHaveAttribute('src', entry.photo);
        await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
      }
      await meal.click();
      await expect(page.getByText(/USDA FoodData Central/)).toBeVisible();
      await meal.click();
      checked++;
    }
    if (day.day < 14) await page.getByRole('button', { name: 'Следующий день' }).click();
  }
  expect(checked).toBe(33);
  await page.getByRole('button', { name: 'Следующий день' }).click();
  await expect(page.getByText('Для этого дня материалы пока не добавлены.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отметить день выполненным' })).toBeDisabled();
});
