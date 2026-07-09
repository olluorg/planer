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

/** HTML-отчёт для печати в PDF (window.print → «Сохранить как PDF»). Без внешних зависимостей. */
export function buildWeeklyHtml(date: Date, s: State): string {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const dayKeys = days.map(dayISO);
  const tasksWeek = s.tasks.filter((t) => dayKeys.includes(t.date));
  const done = tasksWeek.filter((t) => t.status === 'done').length;
  const total = tasksWeek.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const validMoods = days.map((d) => s.reflections.find((x) => x.date === dayISO(d))?.mood).filter((m): m is number => m != null);
  const avgMood = validMoods.length ? (validMoods.reduce((a, b) => a + b, 0) / validMoods.length).toFixed(1) : '—';
  const esc = (v: string) => v.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

  const goalRows = s.goals.map((g) => {
    const denom = g.target_value - g.start_value || 1;
    const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
    return `<tr><td>${esc(g.title)}</td><td class="num">${g.current_value}${g.unit ? ' ' + esc(g.unit) : ''} / ${g.target_value}</td><td class="num">${r}%</td></tr>`;
  }).join('');
  const habitRows = s.habits.map((h) => {
    const cnt = dayKeys.filter((d) => s.habitLogs.some((l) => l.habit_id === h.id && l.date === d)).length;
    return `<tr><td>${esc(h.title)}</td><td class="num">${cnt} / 7</td></tr>`;
  }).join('');
  const dayBlocks = days.map((d) => {
    const dk = dayISO(d);
    const dt = s.tasks.filter((t) => t.date === dk);
    const dDone = dt.filter((t) => t.status === 'done').length;
    const ref = s.reflections.find((x) => x.date === dk);
    const bits = [`Задачи: ${dDone}/${dt.length}`];
    if (ref?.mood != null) bits.push(`настроение ${ref.mood + 1}/5`);
    let extra = '';
    if (ref?.done) extra += `<div class="ref">✓ ${esc(ref.done)}</div>`;
    if (ref?.not_done) extra += `<div class="ref">↑ ${esc(ref.not_done)}</div>`;
    return `<div class="day"><h3>${format(d, 'EEEE, d MMM', { locale: ru })}</h3><div class="muted">${bits.join(' · ')}</div>${extra}</div>`;
  }).join('');

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Отчёт THEDAD</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; color: #1e293b; margin: 40px; }
  h1 { font-size: 24px; margin: 0 0 4px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: .05em; color: #64748b; margin: 28px 0 10px; }
  h3 { font-size: 14px; margin: 0 0 2px; text-transform: capitalize; }
  .sub { color: #64748b; margin-bottom: 8px; }
  .kpis { display: flex; gap: 16px; margin-top: 12px; }
  .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px; }
  .kpi .v { font-size: 22px; font-weight: 700; }
  .kpi .l { font-size: 11px; color: #64748b; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 4px; border-bottom: 1px solid #eef2f7; font-size: 13px; }
  .num { text-align: right; color: #475569; white-space: nowrap; }
  .day { break-inside: avoid; padding: 8px 0; border-bottom: 1px solid #eef2f7; }
  .muted { color: #64748b; font-size: 12px; }
  .ref { font-size: 12px; color: #334155; margin-top: 2px; }
  @media print { body { margin: 16mm; } .kpi { -webkit-print-color-adjust: exact; } }
</style></head><body>
  <h1>Отчёт за неделю</h1>
  <div class="sub">${format(start, 'd MMM', { locale: ru })} — ${format(addDays(start, 6), 'd MMM yyyy', { locale: ru })}</div>
  <div class="kpis">
    <div class="kpi"><div class="v">${done}/${total}</div><div class="l">Задачи · ${pct}%</div></div>
    <div class="kpi"><div class="v">${avgMood}</div><div class="l">Настроение /5</div></div>
    <div class="kpi"><div class="v">${s.goals.filter((g) => g.status === 'active').length}</div><div class="l">Активных целей</div></div>
  </div>
  <h2>Цели и прогресс</h2><table>${goalRows || '<tr><td class="muted">Нет целей</td></tr>'}</table>
  <h2>Привычки</h2><table>${habitRows || '<tr><td class="muted">Нет привычек</td></tr>'}</table>
  <h2>По дням</h2>${dayBlocks}
</body></html>`;
}

/** Открывает отчёт в новом окне и вызывает печать (Сохранить как PDF). */
export function printWeeklyReport(date: Date, s: State) {
  const html = buildWeeklyHtml(date, s);
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
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
