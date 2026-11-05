import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validatePlugin } from '../plugins';

it('does not present uncalculated calories in the program or its meal widget', () => {
  const program = JSON.parse(readFileSync('content/programs/weight-loss-8w.json', 'utf8'));
  expect(program.days.flatMap((day: any) => day.meals ?? []).length).toBeGreaterThan(0);
  for (const day of program.days) for (const meal of day.meals ?? []) expect(meal).not.toHaveProperty('kcal');
  for (const meal of program.plugin.source.static) expect(meal).not.toHaveProperty('kcal');
  expect(program.plugin.render.badge).not.toContain('kcal');
  expect(validatePlugin(program.plugin).ok).toBe(true);
});
