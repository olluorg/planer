import { addDays } from 'date-fns';
import type { Habit, HabitLog, Reflection, Task } from './types';
import { isoDate } from './utils';

function pearson(a: number[], b: number[]): number | null {
  const n = a.length;
  if (n < 3 || n !== b.length) return null;
  const ma = a.reduce((sum, x) => sum + x, 0) / n;
  const mb = b.reduce((sum, x) => sum + x, 0) / n;
  let numerator = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) {
    numerator += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? numerator / Math.sqrt(da * db) : null;
}

export function habitCorrelations(habits: Habit[], logs: HabitLog[], tasks: Task[], reflections: Reflection[], today: Date) {
  const dates = Array.from({ length: 60 }, (_, i) => isoDate(addDays(today, i - 59)));
  return habits.map((habit) => {
    const moodValues: number[] = [], moodHabit: number[] = [], taskValues: number[] = [], taskHabit: number[] = [];
    const created = isoDate(new Date(habit.created_at));
    for (const date of dates) {
      if (date < created) continue;
      const done = logs.some((log) => log.habit_id === habit.id && log.date === date && log.done > 0) ? 1 : 0;
      const reflection = reflections.find((item) => item.date === date && item.mood !== null);
      if (reflection && reflection.mood !== null) { moodHabit.push(done); moodValues.push(reflection.mood); }
      const dailyTasks = tasks.filter((task) => task.date === date);
      if (dailyTasks.length) {
        taskHabit.push(done);
        taskValues.push(dailyTasks.filter((task) => task.status === 'done').length / dailyTasks.length);
      }
    }
    return { id: habit.id, title: habit.title, rMood: pearson(moodHabit, moodValues), rTasks: pearson(taskHabit, taskValues), moodDays: moodValues.length, taskDays: taskValues.length };
  });
}
