import { startOfWeek, addDays } from 'date-fns';
import { isoDate } from './utils';
import type { XpEntry } from './types';

export interface League {
  key: string;
  label: string;
  color: string;
  minXp: number; // XP required per week to reach
}

export const LEAGUES: League[] = [
  { key: 'bronze',   label: 'Бронза',     color: '#a16207', minXp: 0   },
  { key: 'silver',   label: 'Серебро',    color: '#9ca3af', minXp: 200 },
  { key: 'gold',     label: 'Золото',     color: '#eab308', minXp: 500 },
  { key: 'sapphire', label: 'Сапфир',     color: '#3b82f6', minXp: 900 },
  { key: 'ruby',     label: 'Рубин',      color: '#ef4444', minXp: 1400 },
  { key: 'diamond',  label: 'Бриллиант',  color: '#06b6d4', minXp: 2000 },
];

export function leagueFor(weekXp: number): League {
  let result = LEAGUES[0];
  for (const l of LEAGUES) if (weekXp >= l.minXp) result = l;
  return result;
}

export function nextLeague(weekXp: number): League | null {
  for (const l of LEAGUES) if (l.minXp > weekXp) return l;
  return null;
}

export function xpInWeek(log: XpEntry[], date: Date): number {
  const ws = startOfWeek(date, { weekStartsOn: 1 });
  const dates = Array.from({ length: 7 }, (_, i) => isoDate(addDays(ws, i)));
  return log.filter((e) => dates.includes(e.date)).reduce((s, e) => s + e.amount, 0);
}

export function buildHistory(log: XpEntry[], weeks: number): { weekStart: string; xp: number; league: League }[] {
  const out: { weekStart: string; xp: number; league: League }[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = addDays(new Date(), -7 * i);
    const ws = startOfWeek(d, { weekStartsOn: 1 });
    const dates = Array.from({ length: 7 }, (_, k) => isoDate(addDays(ws, k)));
    const xp = log.filter((e) => dates.includes(e.date)).reduce((s, e) => s + e.amount, 0);
    out.push({ weekStart: isoDate(ws), xp, league: leagueFor(xp) });
  }
  return out;
}
