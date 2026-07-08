import { addDays } from 'date-fns';
import { isoDate } from './utils';
import type { Recurrence } from './types';

export const RECURRENCE_LABEL: Record<Exclude<Recurrence, null>, string> = {
  daily: 'Каждый день',
  weekdays: 'По будням',
  weekends: 'По выходным',
  weekly: 'Раз в неделю',
};

function matches(rule: Exclude<Recurrence, null>, d: Date): boolean {
  const dow = d.getDay(); // 0=вс … 6=сб
  if (rule === 'daily') return true;
  if (rule === 'weekdays') return dow >= 1 && dow <= 5;
  if (rule === 'weekends') return dow === 0 || dow === 6;
  return true; // weekly матчит любой день — важен шаг, а не день недели
}

/** Следующая дата (isoDate) строго после `fromISO`, подходящая под правило.
 *  weekly — тот же день недели через 7 дней; остальные — ближайший подходящий день. */
export function nextRecurrenceDate(rule: Exclude<Recurrence, null>, fromISO: string): string {
  const from = new Date(fromISO + 'T00:00:00');
  if (rule === 'weekly') return isoDate(addDays(from, 7));
  for (let i = 1; i <= 8; i++) {
    const d = addDays(from, i);
    if (matches(rule, d)) return isoDate(d);
  }
  return isoDate(addDays(from, 1));
}
