import { expect, it } from 'vitest';
import { balanceWorkoutSides } from '../workoutPlan';
import { WORKOUT_TYPES } from '../../components/WorkoutMode';

it.each([
  ['Боковая планка слева', 'Боковая планка справа'],
  ['Поза дерева (слева)', 'Поза дерева (справа)'],
])('keeps %s and %s together in seven-exercise plans', (left, right) => {
  const all = Array.from({ length: 12 }, (_, i) => ({ name: `Упражнение ${i}` })).concat([{ name: left }, { name: right }]);
  for (let shift = 0; shift < all.length; shift++) {
    const shuffled = [...all.slice(shift), ...all.slice(0, shift)];
    const plan = balanceWorkoutSides(shuffled, 7);
    expect(plan).toHaveLength(7);
    expect(new Set(plan.map(item => item.name)).size).toBe(7);
    expect(plan.some(item => item.name === left)).toBe(plan.some(item => item.name === right));
  }
});

it('preserves an unpaired source and never adds duplicates', () => {
  const plan = [{ name: 'Боковая планка слева' }, { name: 'Приседания' }];
  expect(balanceWorkoutSides(plan, 2)).toEqual(plan);
});

it.each(['Ягодичный мостик на одной ноге', 'Поза воина II', 'Поза голубя'])(
  'reminds the user to switch sides for %s', (name) => {
    const exercise = WORKOUT_TYPES.flatMap(type => type.exercises).find(item => item.name === name);
    expect(exercise?.hint).toContain('смени сторону');
  },
);
