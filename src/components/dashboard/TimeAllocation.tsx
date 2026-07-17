import { useMemo, useState } from 'react';
import { addDays, startOfWeek, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { ECharts } from '@/components/charts/ECharts';
import { Checkbox } from '@/components/ui/checkbox';

// Распределение задач недели по тайм-блокам (реальные данные, цвета как в Плане/Календаре).
const SEGMENTS = [
  { key: 'morning', label: 'Утро', color: '#f59e0b' },
  { key: 'day', label: 'День', color: '#6366f1' },
  { key: 'evening', label: 'Вечер', color: '#8b5cf6' },
  { key: 'night', label: 'Ночь', color: '#3b82f6' },
  { key: 'none', label: 'Без блока', color: '#94a3b8' },
] as const;

export const TimeAllocation: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks, toggleTask } = useStore();
  const [sel, setSel] = useState<string | null>(null);

  const { data, total, weekTasks } = useMemo(() => {
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    const days = new Set(Array.from({ length: 7 }, (_, i) => isoDate(addDays(ws, i))));
    const wk = tasks.filter((t) => days.has(t.date) && !t.parent_id);
    const counts: Record<string, number> = {};
    wk.forEach((t) => {
      const k = (t.time_block as string) ?? 'none';
      counts[k] = (counts[k] ?? 0) + 1;
    });
    const data = SEGMENTS
      .map((s) => ({ key: s.key, name: s.label, value: counts[s.key] ?? 0, itemStyle: { color: s.color } }))
      .filter((d) => d.value > 0);
    return { data, total: wk.length, weekTasks: wk };
  }, [tasks, date]);

  const selTasks = useMemo(
    () => (sel ? weekTasks.filter((t) => ((t.time_block as string) ?? 'none') === sel).sort((a, b) => a.date.localeCompare(b.date)) : []),
    [sel, weekTasks],
  );

  const option = {
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    series: [{
      type: 'pie',
      radius: ['62%', '86%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: false,
      padAngle: 2,
      itemStyle: { borderRadius: 4 },
      label: { show: false },
      labelLine: { show: false },
      data,
    }],
  };

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border shadow-card p-5 flex flex-col">
      <h3 className="text-base font-semibold text-text mb-2 shrink-0">Распределение времени</h3>
      {total === 0 ? (
        <div className="flex-1 flex items-center justify-center text-xs text-text-muted">Нет задач на этой неделе</div>
      ) : (
        <>
          {/* Donut растягивается на доступную высоту ячейки */}
          <div className="relative flex-1 min-h-[120px]">
            <ECharts option={option} height="100%" className="!h-full" />
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-2xl font-bold tabular-nums text-text leading-none">{total}</div>
              <div className="text-[11px] text-text-muted mt-0.5">задач</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 shrink-0">
            {data.map((d) => (
              <button
                key={d.key}
                onClick={() => setSel(sel === d.key ? null : d.key)}
                className={`flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 transition-colors ${
                  sel === d.key ? 'border-accent bg-accent/10 text-text' : 'border-border-soft text-text-muted hover:border-border hover:text-text'
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.itemStyle.color }} />
                <span>{d.name}</span>
                <span className="tabular-nums text-text font-medium">{d.value}</span>
              </button>
            ))}
          </div>

          {/* Отдача по клику: задачи выбранного блока за неделю */}
          {sel && (
            <div className="mt-2.5 rounded-lg border border-border-soft bg-bg-soft/40 p-2 max-h-32 overflow-y-auto shrink-0 space-y-0.5 animate-[slide-up_140ms_ease-out]">
              {selTasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-bg-soft cursor-pointer">
                  <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
                  <span className="text-[10px] text-text-dim tabular-nums shrink-0 w-9">{format(new Date(`${t.date}T00:00:00`), 'EEE', { locale: ru })}</span>
                  <span className={`text-xs flex-1 min-w-0 truncate ${t.status === 'done' ? 'line-through text-text-muted' : 'text-text'}`}>{t.title}</span>
                </label>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
