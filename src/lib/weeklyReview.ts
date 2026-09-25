/** Недельный обзор: пять минут в воскресенье, которые превращают трекер в
 *  ритуал. По каждой цели — сдвинулись ли за неделю столько, сколько нужно;
 *  что из задач осталось висеть и куда его деть; что вы сами записали о неделе.
 *  Здесь только расчёт; окно — components/WeeklyReview.tsx. */
import { addDays, startOfWeek } from 'date-fns';
import type { Goal, Habit, HabitLog, ProgressRecord, Reflection, Task } from './types';
import { isoDate, todayISO } from './utils';

export interface WeekData {
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  progress: ProgressRecord[];
  reflections: Reflection[];
}

export type GoalPace = 'ahead' | 'on_track' | 'behind' | 'idle' | 'no_data';

export interface GoalWeek {
  goal: Goal;
  /** Сдвиг за неделю (со знаком цели: «к цели» — положительный). */
  moved: number | null;
  /** Сколько нужно было пройти за неделю, чтобы успеть к сроку. null — срока нет. */
  needed: number | null;
  pace: GoalPace;
}

export interface WeekReview {
  weekStart: string;
  weekEnd: string;
  goals: GoalWeek[];
  tasksDone: number;
  tasksTotal: number;
  /** Незакрытые задачи недели — кандидаты на перенос. */
  leftover: Task[];
  habits: { habit: Habit; done: number; target: number }[];
  /** Что пользователь сам записал о неделе в рефлексиях. */
  notes: { date: string; good: string | null; improve: string | null }[];
  avgMood: number | null;
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / DAY);

/** Неделя с понедельника, в которой лежит дата. */
export function weekBounds(today = todayISO()): { start: string; end: string } {
  const [y, m, d] = today.split('-').map(Number);
  const start = startOfWeek(new Date(y, m - 1, d), { weekStartsOn: 1 });
  return { start: isoDate(start), end: isoDate(addDays(start, 6)) };
}

/** Понедельник следующей недели — куда переносим незакрытое. */
export function nextMonday(today = todayISO()): string {
  const { start } = weekBounds(today);
  const [y, m, d] = start.split('-').map(Number);
  return isoDate(addDays(new Date(y, m - 1, d), 7));
}

/** Последнее значение на дату включительно (по отметкам). */
function valueAt(recs: ProgressRecord[], date: string): number | null {
  let best: ProgressRecord | null = null;
  for (const r of recs) if (r.date <= date && (!best || r.date >= best.date)) best = r;
  return best ? best.value : null;
}

function goalWeek(g: Goal, progress: ProgressRecord[], start: string, end: string): GoalWeek {
  const recs = progress.filter((r) => r.goal_id === g.id);
  const dir = g.target_value >= g.start_value ? 1 : -1;
  const beforeWeek = addDaysIso(start, -1);
  const atStart = valueAt(recs, beforeWeek) ?? (recs.length ? g.start_value : null);
  const atEnd = valueAt(recs, end);
  const hadMarksThisWeek = recs.some((r) => r.date >= start && r.date <= end);

  if (atEnd === null) return { goal: g, moved: null, needed: null, pace: 'no_data' };
  const moved = atStart === null ? 0 : (atEnd - atStart) * dir;

  let needed: number | null = null;
  if (g.deadline && g.deadline > end) {
    const remaining = (g.target_value - atEnd) * dir;
    const days = daysBetween(end, g.deadline);
    needed = remaining > 0 ? (remaining / days) * 7 : 0;
  }

  let pace: GoalPace;
  if (!hadMarksThisWeek) pace = 'idle';
  else if (needed === null) pace = moved > 0 ? 'on_track' : 'idle';
  else if (moved >= needed * 1.1) pace = 'ahead';
  else if (moved >= needed * 0.9) pace = 'on_track';
  else pace = 'behind';
  return { goal: g, moved, needed, pace };
}

function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return isoDate(addDays(new Date(y, m - 1, d), n));
}

export function buildWeekReview(s: WeekData, today = todayISO()): WeekReview {
  const { start, end } = weekBounds(today);
  const inWeek = (d: string) => d >= start && d <= end;

  const weekTasks = s.tasks.filter((t) => !t.parent_id && inWeek(t.date));
  const leftover = weekTasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => a.date.localeCompare(b.date) || a.priority - b.priority);

  const habits = s.habits.map((h) => {
    const done = s.habitLogs.filter((l) => l.habit_id === h.id && inWeek(l.date) && l.done).length;
    return { habit: h, done, target: h.schedule === 'daily' ? 7 : h.target_per_week ?? 7 };
  });

  const weekRefl = s.reflections.filter((r) => inWeek(r.date)).sort((a, b) => a.date.localeCompare(b.date));
  const moods = weekRefl.map((r) => r.mood).filter((m): m is number => m !== null);

  return {
    weekStart: start,
    weekEnd: end,
    goals: s.goals.filter((g) => g.status === 'active').map((g) => goalWeek(g, s.progress, start, end)),
    tasksDone: weekTasks.filter((t) => t.status === 'done').length,
    tasksTotal: weekTasks.length,
    leftover,
    habits,
    notes: weekRefl
      .filter((r) => (r.done && r.done.trim()) || (r.not_done && r.not_done.trim()))
      .map((r) => ({ date: r.date, good: r.done?.trim() || null, improve: r.not_done?.trim() || null })),
    avgMood: moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null,
  };
}

/* ===== Прошёл ли обзор на этой неделе ===== */

const DONE_KEY = 'thedad.weekly-review.done';

export function reviewDoneThisWeek(today = todayISO()): boolean {
  try { return localStorage.getItem(DONE_KEY) === weekBounds(today).start; } catch { return false; }
}

export function markReviewDone(today = todayISO()) {
  try { localStorage.setItem(DONE_KEY, weekBounds(today).start); } catch { /* приватный режим */ }
}

/** Пора ли позвать на обзор: воскресенье, и обзор этой недели ещё не пройден. */
export function reviewDue(now = new Date()): boolean {
  const dow = now.getDay(); // 0 — воскресенье
  if (dow !== 0) return false;
  return !reviewDoneThisWeek(isoDate(now));
}
