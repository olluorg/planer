import { startOfWeek, startOfMonth, addDays, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { isoDate } from './utils';
import type { XpEntry } from './types';

export interface WeekRec { weekStart: string; label: string; xp: number; }
export interface MonthRec { monthStart: string; label: string; xp: number; }

export function weeklyXpHistory(log: XpEntry[], weeks: number): WeekRec[] {
  const out: WeekRec[] = [];
  for (let i = 0; i < weeks; i++) {
    const ref = addDays(new Date(), -7 * i);
    const ws = startOfWeek(ref, { weekStartsOn: 1 });
    const dates = Array.from({ length: 7 }, (_, k) => isoDate(addDays(ws, k)));
    const xp = log.filter((e) => dates.includes(e.date)).reduce((s, e) => s + e.amount, 0);
    out.push({ weekStart: isoDate(ws), label: format(ws, 'd MMM', { locale: ru }), xp });
  }
  return out;
}

export function monthlyXpHistory(log: XpEntry[], months: number): MonthRec[] {
  const out: MonthRec[] = [];
  for (let i = 0; i < months; i++) {
    const ref = new Date();
    ref.setMonth(ref.getMonth() - i);
    const ms = startOfMonth(ref);
    const ym = format(ms, 'yyyy-MM');
    const xp = log.filter((e) => e.date.startsWith(ym)).reduce((s, e) => s + e.amount, 0);
    out.push({ monthStart: isoDate(ms), label: format(ms, 'LLLL yyyy', { locale: ru }), xp });
  }
  return out;
}

export function bestWeek(weeks: WeekRec[]): WeekRec | null {
  if (weeks.length === 0) return null;
  return weeks.reduce((a, b) => (b.xp > a.xp ? b : a));
}
export function bestMonth(months: MonthRec[]): MonthRec | null {
  if (months.length === 0) return null;
  return months.reduce((a, b) => (b.xp > a.xp ? b : a));
}
