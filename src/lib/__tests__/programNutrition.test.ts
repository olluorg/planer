import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validatePlugin } from '../plugins';
import { DINING_COLLECTION } from '../diningCollection';

it('only uses documented meal nutrition and omits uncalculated widget values', () => {
  const program = JSON.parse(readFileSync('content/programs/weight-loss-8w.json', 'utf8'));
  expect(program.days.flatMap((day: any) => day.meals ?? []).length).toBeGreaterThan(0);
  expect(program.days.flatMap((day: any) => day.meals ?? []).filter((meal: any) => typeof meal.kcal === 'number')).toHaveLength(8);
  for (const day of program.days) for (const meal of day.meals ?? []) {
    if (!('kcal' in meal)) continue;
    const source = DINING_COLLECTION.find(dish => dish.title === meal.title);
    expect(source).toBeDefined();
    for (const key of ['kcal', 'protein', 'fat', 'carbs']) expect(meal[key]).toBe(source![key]);
    expect(meal.recipe).toContain('USDA FoodData Central');
  }
  for (const meal of program.plugin.source.static) expect(meal).not.toHaveProperty('kcal');
  expect(program.plugin.render.badge).not.toContain('kcal');
  expect(validatePlugin(program.plugin).ok).toBe(true);
});
