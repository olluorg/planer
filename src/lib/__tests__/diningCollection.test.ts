import { expect, it } from 'vitest';
import { DINING_COLLECTION, withDiningCollection, diningPreview, matchesDiningFilter, diningTotals } from '../diningCollection';
import fs from 'node:fs';
import path from 'node:path';

it('filters by explicit portion values, excluding missing and invalid data', () => {
  expect(matchesDiningFilter({ protein: 25 }, 'protein')).toBe(true);
  expect(matchesDiningFilter({ protein: null }, 'protein')).toBe(false);
  expect(matchesDiningFilter({ kcal: 0 }, 'light')).toBe(false);
  expect(matchesDiningFilter({ kcal: 400 }, 'light')).toBe(true);
  expect(matchesDiningFilter({ minutes: 15 }, 'quick')).toBe(true);
  expect(matchesDiningFilter({ minutes: 16 }, 'quick')).toBe(false);
  expect(matchesDiningFilter({ title: 'Пицца «Маргарита»' }, 'enjoy')).toBe(true);
  expect(matchesDiningFilter({ title: 'Омлет' }, 'enjoy')).toBe(false);
});
it('reports incomplete daily totals and includes explicit zero', () => {
  expect(diningTotals([{ kcal: 200, protein: 20, fat: 0, carbs: 30 }, { kcal: 100 }])).toEqual({ kcal: 300, protein: 20, fat: 0, carbs: 30, missing: 1 });
});

it('adds recipes without assigning days or replacing the saved schedule', () => {
  const saved = { title: 'Мой завтрак', meal: 'Завтрак', day: 7, kcal: 123 };
  const result = withDiningCollection('nutrition-month', [saved]);
  expect(result[0]).toBe(saved);
  expect(result).toHaveLength(1 + DINING_COLLECTION.length);
  expect(result.slice(1).every((r) => r.day === undefined)).toBe(true);
  expect(withDiningCollection('nutrition-month', result)).toHaveLength(1 + DINING_COLLECTION.length);
});
it('keeps user-edited versions and leaves unrelated plugins unchanged', () => {
  const custom: Record<string, string | number | null> = { ...DINING_COLLECTION[0], recipe: 'Мой рецепт', kcal: 450, day: 2 };
  const result = withDiningCollection('nutrition-month', [custom]);
  expect(result.filter((r) => r.title === custom.title)).toEqual([custom]);
  expect(withDiningCollection('custom-plugin', [custom])).toEqual([custom]);
});
it('ships real local images and thumbnails for each new recipe', () => {
  for (const dish of DINING_COLLECTION) {
    expect(Number(dish.kcal)).toBeGreaterThan(0);
    for (const key of ['protein', 'fat', 'carbs']) expect(typeof dish[key] === 'number' && Number(dish[key]) >= 0).toBe(true);
    expect(dish.recipe).toContain('Ингредиенты:');
    for (const url of [dish.image as string, diningPreview(dish.image as string)]) {
      expect(fs.existsSync(path.join(process.cwd(), 'public', url))).toBe(true);
    }
  }
});
