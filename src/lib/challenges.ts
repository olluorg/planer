import { startOfWeek, startOfMonth, addDays } from 'date-fns';
import { isoDate } from './utils';
import type { Task, HabitLog, Reflection, TimeEntry, XpEntry } from './types';

/** Повторяющиеся челленджи (как в Duolingo): сбрасываются каждый день/неделю/месяц. */
export type ChallengePeriod = 'day' | 'week' | 'month';

export interface ChallengeCtx {
  now: Date;
  tasks: Task[];
  habitLogs: HabitLog[];
  reflections: Reflection[];
  timeEntries: TimeEntry[];
  xpLog: XpEntry[];
}

export interface ChallengeDef {
  key: string;
  period: ChallengePeriod;
  title: string;
  target: number;
  reward: number;   // XP
  measure: (c: ChallengeCtx, days: Set<string>) => number;
}

const doneTasksIn = (c: ChallengeCtx, days: Set<string>) =>
  c.tasks.filter((t) => t.status === 'done' && days.has(t.date) && !t.parent_id).length;

const focusMinutesIn = (c: ChallengeCtx, days: Set<string>) =>
  Math.round(c.timeEntries.filter((e) => e.type === 'pomodoro' && days.has(isoDate(new Date(e.started_at)))).reduce((s, e) => s + e.duration, 0) / 60);

const habitMarksIn = (c: ChallengeCtx, days: Set<string>) =>
  c.habitLogs.filter((l) => days.has(l.date)).length;

const reflectionDaysIn = (c: ChallengeCtx, days: Set<string>) =>
  c.reflections.filter((r) => r.mood !== null && days.has(r.date)).length;

const xpIn = (c: ChallengeCtx, days: Set<string>) =>
  c.xpLog.filter((e) => days.has(e.date)).reduce((s, e) => s + e.amount, 0);

export const CHALLENGES: ChallengeDef[] = [
  // День
  { key: 'd_tasks', period: 'day', title: 'Закрой 3 задачи сегодня', target: 3, reward: 20, measure: doneTasksIn },
  { key: 'd_focus', period: 'day', title: '25 минут фокуса', target: 25, reward: 20, measure: focusMinutesIn },
  { key: 'd_reflect', period: 'day', title: 'Запиши рефлексию', target: 1, reward: 15, measure: reflectionDaysIn },
  // Неделя
  { key: 'w_tasks', period: 'week', title: 'Закрой 20 задач за неделю', target: 20, reward: 80, measure: doneTasksIn },
  { key: 'w_focus', period: 'week', title: '5 часов фокуса за неделю', target: 300, reward: 90, measure: focusMinutesIn },
  { key: 'w_habits', period: 'week', title: '25 отметок привычек', target: 25, reward: 70, measure: habitMarksIn },
  { key: 'w_reflect', period: 'week', title: 'Рефлексия 5 дней', target: 5, reward: 60, measure: reflectionDaysIn },
  // Месяц
  { key: 'm_tasks', period: 'month', title: '80 задач за месяц', target: 80, reward: 250, measure: doneTasksIn },
  { key: 'm_focus', period: 'month', title: '20 часов фокуса', target: 1200, reward: 300, measure: focusMinutesIn },
  { key: 'm_xp', period: 'month', title: 'Набери 1000 XP', target: 1000, reward: 200, measure: xpIn },
];

/** Набор дат (isoDate) для периода, включающего `now`. */
export function periodDays(period: ChallengePeriod, now: Date): Set<string> {
  if (period === 'day') return new Set([isoDate(now)]);
  if (period === 'week') {
    const s = startOfWeek(now, { weekStartsOn: 1 });
    return new Set(Array.from({ length: 7 }, (_, i) => isoDate(addDays(s, i))));
  }
  const s = startOfMonth(now);
  const days: string[] = [];
  const d = new Date(s);
  while (d.getMonth() === s.getMonth()) { days.push(isoDate(d)); d.setDate(d.getDate() + 1); }
  return new Set(days);
}

export interface ChallengeProgress extends ChallengeDef {
  current: number;
  pct: number;
  done: boolean;
}

export function computeChallenges(c: ChallengeCtx): Record<ChallengePeriod, ChallengeProgress[]> {
  const out: Record<ChallengePeriod, ChallengeProgress[]> = { day: [], week: [], month: [] };
  for (const ch of CHALLENGES) {
    const days = periodDays(ch.period, c.now);
    const current = Math.min(ch.target, ch.measure(c, days));
    const pct = Math.round((current / ch.target) * 100);
    out[ch.period].push({ ...ch, current, pct, done: current >= ch.target });
  }
  return out;
}
