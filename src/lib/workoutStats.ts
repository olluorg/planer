import type { HealthLog } from './types';
import { isoDate } from './utils';

/** Workout values are total minutes per day, not individual sessions. */
export function workoutMonthStats(logs: HealthLog[], now: Date) {
  const today = isoDate(now);
  const month = today.slice(0, 7);
  const entries = logs.filter((log) => log.metric === 'workout' && Number.isFinite(log.value) && log.value > 0 && log.date.startsWith(month) && log.date <= today);
  return { days: new Set(entries.map((entry) => entry.date)).size, minutes: entries.reduce((total, entry) => total + entry.value, 0) };
}
