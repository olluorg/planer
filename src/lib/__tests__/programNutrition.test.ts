import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validatePlugin } from '../plugins';
import { DINING_COLLECTION } from '../diningCollection';

it('only uses documented meal nutrition and omits uncalculated widget values', () => {
  const program = JSON.parse(readFileSync('content/programs/weight-loss-8w.json', 'utf8'));
  expect(program.days.flatMap((day: any) => day.meals ?? []).length).toBeGreaterThan(0);
  const programOnly: Record<string, { kcal: number; protein: number; fat: number; carbs: number }> = {
    'Овсянка с яблоком и корицей': { kcal: 252, protein: 6.9, fat: 3.5, carbs: 50.4 },
    'Салат с тунцом': { kcal: 201, protein: 37, fat: 2.2, carbs: 7.6 },
    'Запечённая курица + салат': { kcal: 252, protein: 35.4, fat: 9.3, carbs: 5.9 },
    'Рис с индейкой и овощами': { kcal: 532, protein: 42, fat: 8, carbs: 70.5 },
  };
  const sources = readFileSync('docs/NUTRITION_SOURCES.md', 'utf8');
  expect(program.days.flatMap((day: any) => day.meals ?? []).filter((meal: any) => typeof meal.kcal === 'number')).toHaveLength(12);
  for (const day of program.days) for (const meal of day.meals ?? []) {
    if (!('kcal' in meal)) continue;
    const source = DINING_COLLECTION.find(dish => dish.title === meal.title) ?? programOnly[meal.title];
    expect(source).toBeDefined();
    for (const key of ['kcal', 'protein', 'fat', 'carbs'] as const) expect(meal[key]).toBe(source![key]);
    expect(meal.recipe).toContain('USDA FoodData Central');
    expect(sources).toContain(meal.title);
  }
  for (const meal of program.plugin.source.static) expect(meal).not.toHaveProperty('kcal');
  expect(program.plugin.render.badge).not.toContain('kcal');
  expect(validatePlugin(program.plugin).ok).toBe(true);
});
