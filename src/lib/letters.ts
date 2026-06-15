import type { HabitLog, Reflection, Task, TimeEntry, XpEntry } from './types';
import { isoDate, todayISO } from './utils';
import { addDays } from 'date-fns';

export interface LetterCtx {
  today: string;
  streak: number;
  level: number;
  xpToday: number;
  dailyGoal: number;
  tasks: Task[];
  habitLogs: HabitLog[];
  reflections: Reflection[];
  timeEntries: TimeEntry[];
  xpLog: XpEntry[];
}

export interface LetterDef {
  key: string;
  match: (c: LetterCtx) => boolean;
  weight: number; // higher = more likely if multiple match
  render: (c: LetterCtx) => { title: string; body: string; tone: 'warm' | 'urgent' | 'neutral' | 'celebrate' };
}

const LETTERS: LetterDef[] = [
  {
    key: 'streak_broken',
    weight: 100,
    match: (c) => c.streak === 0 && c.xpLog.length > 0,
    render: () => ({
      title: 'Я скучал',
      body: 'Серия потерялась — это не страшно. Главное — вернуться сегодня. Сделай одну небольшую задачу, и я снова улыбнусь.',
      tone: 'warm',
    }),
  },
  {
    key: 'no_reflection_3d',
    weight: 60,
    match: (c) => {
      const days = Array.from({ length: 3 }, (_, i) => isoDate(addDays(new Date(c.today), -i)));
      return days.every((d) => !c.reflections.some((r) => r.date === d && r.mood !== null));
    },
    render: () => ({
      title: 'Где рефлексия?',
      body: 'Уже 3 дня без записи в дневник. Без рефлексии трудно заметить рост. Уделить 2 минуты вечером?',
      tone: 'urgent',
    }),
  },
  {
    key: 'great_streak',
    weight: 80,
    match: (c) => c.streak >= 7,
    render: (c) => ({
      title: 'Ты в потоке',
      body: `${c.streak} дней подряд — это уже привычка. Продолжай, и она станет частью тебя.`,
      tone: 'celebrate',
    }),
  },
  {
    key: 'almost_daily',
    weight: 50,
    match: (c) => c.xpToday > 0 && c.xpToday < c.dailyGoal && c.dailyGoal - c.xpToday <= 20,
    render: (c) => ({
      title: 'Чуть-чуть!',
      body: `До дневной цели осталось ${c.dailyGoal - c.xpToday} XP. Одно действие — и сегодня закроется по полной.`,
      tone: 'urgent',
    }),
  },
  {
    key: 'level_up_soon',
    weight: 40,
    match: () => false, // placeholder; could be added later
    render: () => ({ title: '', body: '', tone: 'neutral' }),
  },
  {
    key: 'idle_morning',
    weight: 30,
    match: (c) => {
      const hour = new Date().getHours();
      if (hour < 10 || hour > 12) return false;
      return c.tasks.filter((t) => t.date === c.today && t.status === 'done').length === 0;
    },
    render: () => ({
      title: 'Утро без победы',
      body: 'Самое сложное — начать. Закрой одну задачу, и день встанет на рельсы.',
      tone: 'neutral',
    }),
  },
  {
    key: 'no_pomodoro_week',
    weight: 35,
    match: (c) => {
      const weekDates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(c.today), -i)));
      const pomos = c.timeEntries.filter((e) => weekDates.includes(isoDate(new Date(e.started_at))) && e.type === 'pomodoro');
      return pomos.length === 0 && c.tasks.length > 0;
    },
    render: () => ({
      title: 'Попробуй pomodoro',
      body: '25 минут глубокой работы дают больше, чем час с отвлечениями. Запусти таймер сверху.',
      tone: 'neutral',
    }),
  },
];

export function pickLetter(ctx: LetterCtx): LetterDef | null {
  const matched = LETTERS.filter((l) => l.match(ctx));
  if (matched.length === 0) return null;
  const totalWeight = matched.reduce((s, l) => s + l.weight, 0);
  let r = Math.random() * totalWeight;
  for (const l of matched) {
    r -= l.weight;
    if (r <= 0) return l;
  }
  return matched[0];
}

const KEY = 'thedad.letter.shown.v1';

export function lastShownDate(): string | null {
  try { return localStorage.getItem(KEY); } catch { return null; }
}
export function markShown(date = todayISO()) {
  localStorage.setItem(KEY, date);
}

export const LETTERS_FOR_PREVIEW = LETTERS;
