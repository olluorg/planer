// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { addManual, burnedKcal, getManual, isWorkoutStorageReadable, logWorkout, workoutSeconds, WORKOUT_TYPE_MET } from '../activity';
import { exportPersonalData, parsePersonalData } from '../personalBackup';

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

it('estimates mixed workouts by type and keeps existing duration data', () => {
  const date = '2026-11-01';
  localStorage.setItem('workout.sessions.v1', JSON.stringify({ [date]: 60 }));
  logWorkout(date, 60, WORKOUT_TYPE_MET.yoga);
  logWorkout(date, 120, WORKOUT_TYPE_MET.calisthenics);
  expect(workoutSeconds(date)).toBe(240);
  expect(burnedKcal(date, 0, 70).workoutKcal).toBe(Math.round((8 + 2.3 + 10 - 4) * 3.5 * 70 / 200));
  expect(parsePersonalData(exportPersonalData()).values['workout.met-seconds.v1']).toBeTruthy();
});

it('falls back to the old estimate when metadata and duration disagree', () => {
  localStorage.setItem('workout.sessions.v1', '{"2026-11-01":120}');
  localStorage.setItem('workout.met-seconds.v1', '{"2026-11-01":{"seconds":60,"metSeconds":138}}');
  expect(burnedKcal('2026-11-01', 0, 70).workoutKcal).toBe(Math.round(2 * 7 * 3.5 * 70 / 200));
});

it('does not count resting expenditure twice for manual activity', () => {
  addManual('2026-11-01', 'Йога', 60, 3, 70);
  const result = burnedKcal('2026-11-01', 0, 70);
  expect(result.manual[0].kcal).toBe(Math.round(3 * 3.5 * 70 / 200 * 60));
  expect(result.manualKcal).toBe(Math.round(result.manual[0].kcal * 2 / 3));
  expect(result.total).toBe(result.manualKcal);
});

it('accepts backups created before workout intensity tracking', () => {
  const file = exportPersonalData();
  delete file.values['workout.met-seconds.v1'];
  expect(parsePersonalData(file).values['workout.met-seconds.v1']).toBeNull();
});

it('preserves activity older than 90 recorded days', () => {
  for (let i = 0; i < 92; i++) addManual(`day-${String(i).padStart(3, '0')}`, 'Ходьба', 10, 3.5, 70);
  expect(getManual('day-000')).toHaveLength(1);
  expect(Object.keys(JSON.parse(localStorage.getItem('activity.manual.v1')!))).toHaveLength(92);
});

it.each([NaN, Infinity, -1, 0, 1.5, 1441])('rejects invalid manual duration %s without saving', (minutes) => {
  expect(() => addManual('2026-11-01', 'Ходьба', minutes, 3.5, 70)).toThrow('целое число минут');
  expect(localStorage.getItem('activity.manual.v1')).toBeNull();
});

it('reports a failed workout write and restores the previous intensity details', () => {
  const originalDetail = '{"2026-11-01":{"seconds":60,"metSeconds":138}}';
  const data = new Map<string, string>([['workout.sessions.v1', '{"2026-11-01":60}'], ['workout.met-seconds.v1', originalDetail]]);
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { if (key === 'workout.sessions.v1') throw new Error('quota'); data.set(key, value); },
    removeItem: (key: string) => data.delete(key),
  });
  const dispatch = vi.spyOn(window, 'dispatchEvent');
  expect(() => logWorkout('2026-11-01', 60, 3)).toThrow('Не удалось сохранить активность');
  expect(data.get('workout.met-seconds.v1')).toBe(originalDetail);
  expect(workoutSeconds('2026-11-01')).toBe(60);
  expect(dispatch).not.toHaveBeenCalled();
  dispatch.mockRestore();
});

it('refuses to overwrite corrupted activity data', () => {
  localStorage.setItem('activity.manual.v1', '{broken');
  localStorage.setItem('workout.sessions.v1', '{"bad":null}');
  expect(isWorkoutStorageReadable()).toBe(false);
  expect(() => addManual('2026-11-02', 'Ходьба', 10, 3.5, 70)).toThrow('повреждён');
  expect(() => logWorkout('2026-11-02', 60)).toThrow('повреждён');
  expect(localStorage.getItem('activity.manual.v1')).toBe('{broken');
  expect(localStorage.getItem('workout.sessions.v1')).toBe('{"bad":null}');
});
