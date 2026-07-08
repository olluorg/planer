import { addDays, differenceInCalendarDays } from 'date-fns';
import { isoDate } from './utils';
import type { Achievement, HabitLog, Reflection, Task, XpEntry } from './types';
import { isFreezeUsed } from './streakFreeze';

export const XP_REWARDS = {
  task: 5,
  subtask: 1,
  habit: 2,
  progress: 10,
  reflection: 5,
  pomodoro_25: 15,
  pomodoro_50: 30,
  pomodoro_15: 8,
} as const;

export type XpSource = keyof typeof XP_REWARDS;

// Linear-ish level curve: level N requires N*100 XP cumulatively up to that level.
// Simpler: level = floor(sqrt(xp / 50)).
export function levelFromXp(xp: number): { level: number; current: number; nextThreshold: number; pct: number } {
  const level = Math.floor(Math.sqrt(xp / 50));
  const lo = level * level * 50;
  const hi = (level + 1) * (level + 1) * 50;
  const span = hi - lo || 1;
  return { level, current: xp - lo, nextThreshold: hi - lo, pct: Math.round(((xp - lo) / span) * 100) };
}

export const TITLES = [
  'Новичок', 'Практик', 'Ускоритель', 'Мастер', 'Атлант', 'Витрувий',
  'Гроссмейстер', 'Архитектор жизни',
];

export function titleForLevel(lvl: number): string {
  return TITLES[Math.min(lvl, TITLES.length - 1)];
}

// Активность дня (минимум: задача / привычка / рефлексия)
export function isActiveDay(date: string, tasks: Task[], habitLogs: HabitLog[], reflections: Reflection[]): boolean {
  if (tasks.some((t) => t.date === date && t.status === 'done')) return true;
  if (habitLogs.some((l) => l.date === date)) return true;
  if (reflections.some((r) => r.date === date && r.mood !== null)) return true;
  return false;
}

// День считается «закрытым» (=keeps streak) только если активность + рефлексия с mood.
// Исключение: сегодняшний день — пока не настал вечер, активность сохраняет streak (рефлексию ещё не успел).
export function isSealedDay(date: string, tasks: Task[], habitLogs: HabitLog[], reflections: Reflection[]): boolean {
  const hasReflection = reflections.some((r) => r.date === date && r.mood !== null);
  if (!hasReflection) return false;
  return isActiveDay(date, tasks, habitLogs, reflections);
}

export function computeStreak(today: Date, tasks: Task[], habitLogs: HabitLog[], reflections: Reflection[]): number {
  let count = 0;
  const todayIso = isoDate(today);
  for (let i = 0; i < 365; i++) {
    const d = isoDate(addDays(today, -i));
    const isToday = d === todayIso;
    if (isToday) {
      // Сегодня: активность достаточна (рефлексия пока не обязательна)
      if (isActiveDay(d, tasks, habitLogs, reflections)) { count++; continue; }
      if (i === 0) continue; // сегодня пусто — не ломает
    } else {
      if (isSealedDay(d, tasks, habitLogs, reflections)) { count++; continue; }
      if (isFreezeUsed(d)) { count++; continue; }
      break;
    }
  }
  return count;
}

// Сегодня день ещё «не закрыт»? (есть активность, но нет рефлексии)
export function isTodayUnsealed(today: Date, tasks: Task[], habitLogs: HabitLog[], reflections: Reflection[]): boolean {
  const d = isoDate(today);
  return isActiveDay(d, tasks, habitLogs, reflections) && !reflections.some((r) => r.date === d && r.mood !== null);
}

export function xpToday(date: string, log: XpEntry[]): number {
  return log.filter((e) => e.date === date).reduce((s, e) => s + e.amount, 0);
}
export function xpTotal(log: XpEntry[]): number {
  return log.reduce((s, e) => s + e.amount, 0);
}

// Achievement definitions.
export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  icon: string; // emoji
  check: (s: AchievementContext) => boolean;
}

export interface AchievementContext {
  tasks: Task[];
  habitLogs: HabitLog[];
  reflections: Reflection[];
  xp: number;
  level: number;
  streak: number;
  pomodoroCount: number;
  comboCount: number;
  freezesUsed: number;
  weeklyWins: number;
  dailyQuestsAllDayCount: number;
  highestLeagueIndex: number;
  weekXp: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: 'first_task',      title: 'Первый шаг',        description: 'Выполни первую задачу',          icon: '✅',
    check: (c) => c.tasks.filter((t) => t.status === 'done').length >= 1 },
  { key: 'tasks_10',        title: '10 задач',           description: 'Выполнено 10 задач',              icon: '🎯',
    check: (c) => c.tasks.filter((t) => t.status === 'done').length >= 10 },
  { key: 'tasks_100',       title: 'Сотня',              description: 'Выполнено 100 задач',             icon: '💯',
    check: (c) => c.tasks.filter((t) => t.status === 'done').length >= 100 },
  { key: 'streak_3',        title: '3 дня подряд',       description: 'Streak 3 дня',                    icon: '🔥',
    check: (c) => c.streak >= 3 },
  { key: 'streak_7',        title: 'Неделя огня',        description: 'Streak 7 дней',                   icon: '🔥',
    check: (c) => c.streak >= 7 },
  { key: 'streak_30',       title: 'Месяц подряд',       description: 'Streak 30 дней',                  icon: '🌋',
    check: (c) => c.streak >= 30 },
  { key: 'level_5',         title: 'Пятый уровень',      description: 'Достигни 5 уровня',               icon: '⭐',
    check: (c) => c.level >= 5 },
  { key: 'level_10',        title: 'Десятый уровень',    description: 'Достигни 10 уровня',              icon: '🌟',
    check: (c) => c.level >= 10 },
  { key: 'reflect_7',       title: 'Внимательность',     description: '7 дней с рефлексией',             icon: '🧘',
    check: (c) => c.reflections.length >= 7 },
  { key: 'pomodoro_10',     title: '10 помидоров',       description: 'Заверши 10 pomodoro',             icon: '🍅',
    check: (c) => c.pomodoroCount >= 10 },
  { key: 'pomodoro_50',     title: '50 помидоров',       description: 'Заверши 50 pomodoro',             icon: '🍅',
    check: (c) => c.pomodoroCount >= 50 },
  { key: 'combo_first',     title: 'Поток',              description: 'Первый combo ×1.5',               icon: '⚡',
    check: (c) => c.comboCount >= 1 },
  { key: 'combo_5',         title: 'Пятый комбо',        description: '5 combo за всё время',            icon: '⚡',
    check: (c) => c.comboCount >= 5 },
  { key: 'freeze_used',     title: 'Холодная голова',    description: 'Использовал заморозку streak',    icon: '❄️',
    check: (c) => c.freezesUsed >= 1 },
  { key: 'weekly_winner',   title: 'Чемпион недели',     description: 'Прошёл недельный челлендж',       icon: '🏆',
    check: (c) => c.weeklyWins >= 1 },
  { key: 'quest_full_day',  title: 'Полный сбор',        description: 'Закрыл все 3 daily quest за день', icon: '🎰',
    check: (c) => c.dailyQuestsAllDayCount >= 1 },
  { key: 'league_diamond',  title: 'Бриллиант',          description: 'Дошёл до лиги Бриллиант',         icon: '💎',
    check: (c) => c.highestLeagueIndex >= 5 },
  { key: 'habit_perfect_week', title: 'Идеальная неделя', description: 'Все привычки 7/7 за неделю',     icon: '🏅',
    check: (c) => {
      // simple: any habit logged 7+ times in any 7-day window
      if (c.habitLogs.length < 7) return false;
      const byHabit = new Map<string, string[]>();
      c.habitLogs.forEach((l) => {
        const arr = byHabit.get(l.habit_id) ?? [];
        arr.push(l.date);
        byHabit.set(l.habit_id, arr);
      });
      for (const dates of byHabit.values()) {
        const sorted = [...new Set(dates)].sort();
        for (let i = 0; i <= sorted.length - 7; i++) {
          const span = differenceInCalendarDays(new Date(sorted[i + 6]), new Date(sorted[i]));
          if (span === 6) return true;
        }
      }
      return false;
    } },
  { key: 'tasks_50',        title: 'Полсотни',           description: 'Выполнено 50 задач',              icon: '🎯',
    check: (c) => c.tasks.filter((t) => t.status === 'done').length >= 50 },
  { key: 'tasks_500',       title: 'Пятьсот',            description: 'Выполнено 500 задач',             icon: '🏆',
    check: (c) => c.tasks.filter((t) => t.status === 'done').length >= 500 },
  { key: 'streak_14',       title: 'Две недели',         description: 'Streak 14 дней',                  icon: '🔥',
    check: (c) => c.streak >= 14 },
  { key: 'streak_100',      title: 'Сотка дней',         description: 'Streak 100 дней',                 icon: '🌋',
    check: (c) => c.streak >= 100 },
  { key: 'level_20',        title: 'Двадцатый уровень',  description: 'Достигни 20 уровня',              icon: '🌟',
    check: (c) => c.level >= 20 },
  { key: 'level_50',        title: 'Полтинник уровня',   description: 'Достигни 50 уровня',              icon: '👑',
    check: (c) => c.level >= 50 },
  { key: 'pomodoro_25',     title: '25 помидоров',       description: 'Заверши 25 pomodoro',             icon: '🍅',
    check: (c) => c.pomodoroCount >= 25 },
  { key: 'pomodoro_100',    title: 'Мастер фокуса',      description: 'Заверши 100 pomodoro',            icon: '🎯',
    check: (c) => c.pomodoroCount >= 100 },
  { key: 'reflect_30',      title: 'Месяц рефлексии',    description: '30 дней с рефлексией',            icon: '🧘',
    check: (c) => c.reflections.length >= 30 },
  { key: 'combo_20',        title: 'Мастер потока',      description: '20 combo за всё время',           icon: '⚡',
    check: (c) => c.comboCount >= 20 },
  { key: 'habits_100',      title: 'Сила привычки',      description: '100 отметок привычек',            icon: '🏅',
    check: (c) => c.habitLogs.length >= 100 },
  { key: 'weekly_winner_5', title: 'Пятикратный чемпион', description: 'Прошёл 5 недельных челленджей',  icon: '💎',
    check: (c) => c.weeklyWins >= 5 },
];

export function checkNewAchievements(ctx: AchievementContext, already: Achievement[]): AchievementDef[] {
  const have = new Set(already.map((a) => a.key));
  return ACHIEVEMENTS.filter((a) => !have.has(a.key) && a.check(ctx));
}
