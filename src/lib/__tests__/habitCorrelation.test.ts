import { describe, expect, it } from 'vitest';
import { habitCorrelations } from '../habitCorrelation';
import type { Habit, HabitLog, Reflection, Task } from '../types';

describe('habit correlations', () => {
  it('excludes days before creation and days without the measured data', () => {
    const habits = [{ id: 'h', title: 'Habit', created_at: '2026-11-02T12:00:00' }] as Habit[];
    const logs = [{ habit_id: 'h', date: '2026-11-02', done: 1 }, { habit_id: 'h', date: '2026-11-04', done: 0 }] as HabitLog[];
    const tasks = [{ date: '2026-11-01', status: 'done' }, { date: '2026-11-02', status: 'done' }, { date: '2026-11-04', status: 'open' }] as Task[];
    const reflections = [{ date: '2026-11-03', mood: 4 }, { date: '2026-11-04', mood: null }] as Reflection[];
    const [result] = habitCorrelations(habits, logs, tasks, reflections, new Date(2026, 10, 4, 12));
    expect(result.taskDays).toBe(2);
    expect(result.moodDays).toBe(1);
    expect(result.rTasks).toBeNull();
    expect(result.rMood).toBeNull();
  });

  it('calculates correlation using only days with tasks', () => {
    const habits = [{ id: 'h', title: 'Habit', created_at: '2026-11-01T12:00:00' }] as Habit[];
    const logs = [{ habit_id: 'h', date: '2026-11-01', done: 1 }, { habit_id: 'h', date: '2026-11-03', done: 1 }] as HabitLog[];
    const tasks = [{ date: '2026-11-01', status: 'done' }, { date: '2026-11-02', status: 'open' }, { date: '2026-11-03', status: 'done' }] as Task[];
    const [result] = habitCorrelations(habits, logs, tasks, [], new Date(2026, 10, 4, 12));
    expect(result.taskDays).toBe(3);
    expect(result.rTasks).toBeCloseTo(1);
  });
});
