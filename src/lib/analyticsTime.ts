import { addDays } from 'date-fns';
import type { TimeEntry } from './types';
import { isoDate } from './utils';

export function recentFocusDays(entries: TimeEntry[], today: Date): number {
  const dates = new Set(Array.from({ length: 30 }, (_, i) => isoDate(addDays(today, -i))));
  return new Set(entries.filter((entry) => entry.type === 'pomodoro' && entry.duration >= 25 * 60 && dates.has(isoDate(new Date(entry.started_at))))
    .map((entry) => isoDate(new Date(entry.started_at)))).size;
}

export function timeByGoal(entries: TimeEntry[], goals: { id: string; title: string }[], today: Date) {
  const dates = new Set(Array.from({ length: 30 }, (_, i) => isoDate(addDays(today, -i))));
  const groups = new Map<string | null, number>();
  for (const entry of entries) {
    if (!dates.has(isoDate(new Date(entry.started_at))) || entry.duration <= 0) continue;
    groups.set(entry.goal_id, (groups.get(entry.goal_id) ?? 0) + entry.duration);
  }
  const items = [...groups].map(([id, seconds]) => ({
    name: id ? goals.find((goal) => goal.id === id)?.title ?? 'Удалённая цель' : 'Без цели',
    seconds,
  })).sort((a, b) => b.seconds - a.seconds);
  const totalSeconds = items.reduce((sum, item) => sum + item.seconds, 0);
  if (items.length > 6) items.splice(5, items.length - 5, { name: 'Остальное', seconds: items.slice(5).reduce((sum, item) => sum + item.seconds, 0) });
  return { items, totalSeconds };
}
