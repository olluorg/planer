import { describe, expect, it } from 'vitest';
import { addDays } from 'date-fns';
import type { TimeEntry } from '../types';
import { recentFocusDays, timeByGoal } from '../analyticsTime';

const today = new Date(2026, 10, 4, 12);
function entry(daysAgo: number, goal: string | null, duration = 1800): TimeEntry {
  return { id: `${daysAgo}-${goal}`, task_id: null, goal_id: goal, type: 'pomodoro', started_at: addDays(today, -daysAgo).toISOString(), ended_at: null, duration, note: null };
}

describe('analytics time calculations', () => {
  it('counts distinct focus days only in the last 30 days', () => {
    expect(recentFocusDays([entry(0, null), entry(0, 'a'), entry(29, null), entry(30, null), entry(1, null, 60)], today)).toBe(2);
  });

  it('keeps all recorded time when more than six categories exist', () => {
    const entries = Array.from({ length: 7 }, (_, i) => entry(0, `${i}`, 60 * (i + 1)));
    const result = timeByGoal([...entries, entry(30, null)], [], today);
    expect(result.totalSeconds).toBe(1680);
    expect(result.items).toHaveLength(6);
    expect(result.items.at(-1)).toEqual({ name: 'Остальное', seconds: 180 });
    expect(result.items.reduce((sum, item) => sum + item.seconds, 0)).toBe(result.totalSeconds);
  });
});
