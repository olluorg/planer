// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { buildWeekReview, weekBounds, nextMonday, reviewDue, markReviewDone } from '../weeklyReview';
import type { Goal, ProgressRecord, Task, Habit, HabitLog, Reflection } from '../types';

const SUNDAY = '2026-09-27'; // неделя 21–27 сентября
const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g', parent_id: null, title: 'Бег', type: 'mid', metric: null, start_value: 0, target_value: 100,
  current_value: 0, unit: 'км', deadline: '2026-11-29', status: 'active', color: null, cover: null,
  health_metric: null, created_at: 'x', updated_at: 'x', ...o,
});
const rec = (date: string, value: number, goal_id = 'g'): ProgressRecord => ({ id: date + goal_id, goal_id, date, value, note: null });
const task = (o: Partial<Task>): Task => ({
  id: Math.random().toString(36).slice(2), goal_id: null, parent_id: null, title: 't', notes: null, date: SUNDAY,
  time_block: null, priority: 3, status: 'active', stage: 'todo', completed_at: null, tags: null, estimate_min: null,
  start_time: null, recurrence: null, created_at: 'x', updated_at: 'x', ...o,
} as Task);
const empty = { goals: [] as Goal[], tasks: [] as Task[], habits: [] as Habit[], habitLogs: [] as HabitLog[], progress: [] as ProgressRecord[], reflections: [] as Reflection[] };

describe('границы недели', () => {
  it('неделя с понедельника по воскресенье, в локальных датах', () => {
    expect(weekBounds(SUNDAY)).toEqual({ start: '2026-09-21', end: '2026-09-27' });
    expect(weekBounds('2026-09-21')).toEqual({ start: '2026-09-21', end: '2026-09-27' });
    expect(nextMonday(SUNDAY)).toBe('2026-09-28');
  });
});

describe('цели за неделю', () => {
  // До срока (29 ноября) от конца недели 63 дня = 9 недель.
  it('отставание: прошли меньше, чем нужно в неделю', () => {
    const r = buildWeekReview({ ...empty, goals: [goal()], progress: [rec('2026-09-14', 10), rec('2026-09-26', 15)] }, SUNDAY);
    const g = r.goals[0];
    expect(g.moved).toBe(5);
    expect(g.needed).toBeCloseTo((100 - 15) / 63 * 7, 5); // ≈ 9,4 км в неделю
    expect(g.pace).toBe('behind');
  });

  it('с опережением', () => {
    const r = buildWeekReview({ ...empty, goals: [goal()], progress: [rec('2026-09-14', 10), rec('2026-09-26', 30)] }, SUNDAY);
    expect(r.goals[0].pace).toBe('ahead');
  });

  it('без отметок на этой неделе — «стоит на месте», а не «отстаёт»', () => {
    const r = buildWeekReview({ ...empty, goals: [goal()], progress: [rec('2026-09-10', 10)] }, SUNDAY);
    expect(r.goals[0].pace).toBe('idle');
  });

  it('без отметок вообще — нет данных', () => {
    const r = buildWeekReview({ ...empty, goals: [goal()] }, SUNDAY);
    expect(r.goals[0].pace).toBe('no_data');
  });

  it('убывающая цель считает движение к цели положительным', () => {
    const g = goal({ start_value: 90, target_value: 80, unit: 'кг' });
    const r = buildWeekReview({ ...empty, goals: [g], progress: [rec('2026-09-14', 88), rec('2026-09-26', 87)] }, SUNDAY);
    expect(r.goals[0].moved).toBe(1);
  });

  it('архивные цели в обзор не попадают', () => {
    const r = buildWeekReview({ ...empty, goals: [goal({ status: 'archived' })] }, SUNDAY);
    expect(r.goals).toHaveLength(0);
  });
});

describe('задачи, привычки, записи', () => {
  it('незакрытые задачи недели — на перенос; подзадачи и чужие недели не считаются', () => {
    const tasks = [
      task({ title: 'сделана', status: 'done', date: '2026-09-22' }),
      task({ title: 'висит', date: '2026-09-23' }),
      task({ title: 'подзадача', parent_id: 'x', date: '2026-09-23' }),
      task({ title: 'прошлая неделя', date: '2026-09-15' }),
    ];
    const r = buildWeekReview({ ...empty, tasks }, SUNDAY);
    expect(r.tasksDone).toBe(1);
    expect(r.tasksTotal).toBe(2);
    expect(r.leftover.map((t) => t.title)).toEqual(['висит']);
  });

  it('привычки считаются по дням недели, цель — по расписанию', () => {
    const habits = [{ id: 'h', goal_id: null, title: 'Вода', schedule: 'daily', target_per_week: 7, color: null, created_at: 'x', updated_at: 'x' } as Habit];
    const habitLogs = ['2026-09-21', '2026-09-22', '2026-09-20'].map((date) => ({ id: date, habit_id: 'h', date, done: 1 } as HabitLog));
    const r = buildWeekReview({ ...empty, habits, habitLogs }, SUNDAY);
    expect(r.habits[0]).toMatchObject({ done: 2, target: 7 });
  });

  it('из рефлексий берутся только непустые записи этой недели', () => {
    const reflections = [
      { id: '1', date: '2026-09-22', mood: 3, done: 'Пробежал 5 км', not_done: 'Лёг поздно', reason: null, note: null },
      { id: '2', date: '2026-09-23', mood: 1, done: '  ', not_done: null, reason: null, note: null },
      { id: '3', date: '2026-09-14', mood: 4, done: 'прошлая', not_done: null, reason: null, note: null },
    ] as Reflection[];
    const r = buildWeekReview({ ...empty, reflections }, SUNDAY);
    expect(r.notes).toEqual([{ date: '2026-09-22', good: 'Пробежал 5 км', improve: 'Лёг поздно' }]);
    expect(r.avgMood).toBe(2);
  });
});

describe('когда звать', () => {
  beforeEach(() => localStorage.clear());
  it('в воскресенье, пока обзор не пройден', () => {
    expect(reviewDue(new Date(2026, 8, 27, 19))).toBe(true);   // вс
    expect(reviewDue(new Date(2026, 8, 26, 19))).toBe(false);  // сб
    markReviewDone(SUNDAY);
    expect(reviewDue(new Date(2026, 8, 27, 20))).toBe(false);
  });
});
