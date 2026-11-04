import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeProgram, recommendWorkout } from '../programAdapt';
import type { HealthLog } from '../types';
import type { ProgramPack, WorkoutHub } from '../marketplace';
import { isoDate } from '../utils';

describe('program progress summary', () => {
  const pack = { duration_days: 30, goals: [{ unit: 'кг', target_value: 80 }] } as ProgramPack;
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const log = (date: string, value: number) => ({ id: `${date}-${value}`, date, value, metric: 'weight' } as HealthLog);

  it('describes measured change without prescribing calories or treating target weight as kilos to lose', () => {
    const result = analyzeProgram({ pack, start: isoDate(yesterday), currentDay: 7, healthLogs: [log(isoDate(yesterday), 81), log(isoDate(today), 80)] });
    expect(result[0]).toMatchObject({ title: 'Изменение веса', tone: 'info' });
    expect(result[0].message).toContain('-1.0 кг');
    expect(result[0].message).not.toMatch(/дефицит|уреж|плану|мышц/i);
  });

  it('does not infer a trend from two readings on the same day', () => {
    const date = isoDate(today);
    const result = analyzeProgram({ pack, start: date, currentDay: 3, healthLogs: [log(date, 81), log(date, 80)] });
    expect(result[0].title).toBe('Нужны данные веса');
  });
});

afterEach(() => vi.useRealTimers());

it('keeps a planned rest day even when earlier workouts are missing', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 4, 12)); // Wednesday
  const hub = { sessions: [{ id: 'strength', title: 'Силовая', type: 'strength' }], schedule: [
    { sessions: ['strength'] }, { sessions: ['strength'] }, { sessions: [] }, { sessions: ['strength'] },
    { sessions: ['strength'] }, { sessions: [] }, { sessions: [] },
  ] } as WorkoutHub;
  expect(recommendWorkout(hub, [])).toMatchObject({ title: 'Сегодня день отдыха' });
});
