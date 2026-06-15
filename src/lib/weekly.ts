import { startOfWeek, format } from 'date-fns';
import { isoDate } from './utils';
import type { HabitLog, Reflection, Task, TimeEntry } from './types';

export interface WeeklyContext {
  weekStart: string;
  weekDates: string[];
  tasks: Task[];
  habitLogs: HabitLog[];
  reflections: Reflection[];
  timeEntries: TimeEntry[];
}

export interface WeeklyChallengeDef {
  key: string;
  title: string;
  description: string;
  target: number;
  reward: number; // XP
  measure: (c: WeeklyContext) => number;
}

export const WEEKLY_POOL: WeeklyChallengeDef[] = [
  {
    key: 'tasks_20',
    title: '20 задач за неделю',
    description: 'Закрой 20 задач любого блока',
    target: 20, reward: 100,
    measure: (c) => c.tasks.filter((t) => c.weekDates.includes(t.date) && t.status === 'done').length,
  },
  {
    key: 'tasks_40',
    title: '40 задач за неделю',
    description: 'Серьёзный недельный план',
    target: 40, reward: 200,
    measure: (c) => c.tasks.filter((t) => c.weekDates.includes(t.date) && t.status === 'done').length,
  },
  {
    key: 'pomodoro_20',
    title: '20 помидоров',
    description: 'Заверши 20 pomodoro 25+ минут',
    target: 20, reward: 200,
    measure: (c) => c.timeEntries.filter((e) => {
      const d = isoDate(new Date(e.started_at));
      return c.weekDates.includes(d) && e.type === 'pomodoro' && e.duration >= 25 * 60;
    }).length,
  },
  {
    key: 'reflect_5',
    title: '5 рефлексий',
    description: 'Закрой день рефлексией 5 раз',
    target: 5, reward: 150,
    measure: (c) => c.reflections.filter((r) => c.weekDates.includes(r.date) && r.mood !== null).length,
  },
  {
    key: 'priority_5',
    title: '5 главных задач',
    description: 'Закрой 5 высокоприоритетных задач',
    target: 5, reward: 150,
    measure: (c) => c.tasks.filter((t) => c.weekDates.includes(t.date) && t.status === 'done' && t.priority === 1).length,
  },
];

export interface WeeklyState {
  weekStart: string;
  key: string;
  rewarded: boolean;
}

const KEY = 'weekly.challenge.v1';

export function getWeekStart(d = new Date()): string {
  return isoDate(startOfWeek(d, { weekStartsOn: 1 }));
}

export function loadOrGenerate(): WeeklyState {
  const ws = getWeekStart();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as WeeklyState;
      if (parsed.weekStart === ws) return parsed;
    }
  } catch {}
  const pick = WEEKLY_POOL[Math.floor(Math.random() * WEEKLY_POOL.length)];
  const next: WeeklyState = { weekStart: ws, key: pick.key, rewarded: false };
  localStorage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function save(state: WeeklyState) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function buildContext(today = new Date(), tasks: Task[], habitLogs: HabitLog[], reflections: Reflection[], timeEntries: TimeEntry[]): WeeklyContext {
  const ws = startOfWeek(today, { weekStartsOn: 1 });
  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(ws);
    d.setDate(d.getDate() + i);
    return isoDate(d);
  });
  return { weekStart: format(ws, 'yyyy-MM-dd'), weekDates: dates, tasks, habitLogs, reflections, timeEntries };
}
