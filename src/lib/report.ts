import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import type { Goal, Habit, HabitLog, ProgressRecord, Reflection, Task } from './types';

interface State {
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  progress: ProgressRecord[];
  reflections: Reflection[];
}

function dayISO(d: Date) { return d.toISOString().slice(0, 10); }

export function buildWeeklyMarkdown(date: Date, s: State): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayKeys = days.map(dayISO);

  const tasksWeek = s.tasks.filter((t) => dayKeys.includes(t.date));
  const done = tasksWeek.filter((t) => t.status === 'done').length;
  const total = tasksWeek.length;

  const moods = days.map((d) => {
    const r = s.reflections.find((x) => x.date === dayISO(d));
    return r?.mood ?? null;
  });
  const validMoods = moods.filter((m): m is number => m !== null);
  const avgMood = validMoods.length ? (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(2) : '—';

  const lines: string[] = [];
  lines.push(`# Отчёт за неделю ${format(start, 'd MMM', { locale: ru })} — ${format(addDays(start, 6), 'd MMM yyyy', { locale: ru })}`);
  lines.push('');
  lines.push('## Сводка');
  lines.push(`- Задач выполнено: **${done} / ${total}** (${total ? Math.round(done / total * 100) : 0}%)`);
  lines.push(`- Среднее настроение: **${avgMood}** / 4`);
  lines.push(`- Активных целей: **${s.goals.filter((g) => g.status === 'active').length}**`);
  lines.push('');

  lines.push('## Цели и прогресс');
  s.goals.forEach((g) => {
    const denom = g.target_value - g.start_value || 1;
    const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
    lines.push(`- **${g.title}** — ${g.current_value}${g.unit ? ' ' + g.unit : ''} / ${g.target_value} (${r}%)`);
  });
  lines.push('');

  lines.push('## Привычки');
  s.habits.forEach((h) => {
    const cnt = dayKeys.filter((d) => s.habitLogs.some((l) => l.habit_id === h.id && l.date === d)).length;
    lines.push(`- **${h.title}** — ${cnt} / 7`);
  });
  lines.push('');

  lines.push('## По дням');
  days.forEach((d) => {
    const dk = dayISO(d);
    const dayTasks = s.tasks.filter((t) => t.date === dk);
    const dDone = dayTasks.filter((t) => t.status === 'done').length;
    const ref = s.reflections.find((x) => x.date === dk);
    lines.push(`### ${format(d, 'EEEE, d MMM', { locale: ru })}`);
    lines.push(`Задачи: ${dDone}/${dayTasks.length}${ref?.mood !== null && ref?.mood !== undefined ? ` · настроение ${ref.mood}/4` : ''}`);
    if (ref?.done) lines.push(`Сделано: ${ref.done}`);
    if (ref?.not_done) lines.push(`Не сделано: ${ref.not_done}`);
    if (ref?.reason) lines.push(`Причина: ${ref.reason}`);
    lines.push('');
  });

  return lines.join('\n');
}

export function downloadText(filename: string, content: string, mime = 'text/markdown') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
