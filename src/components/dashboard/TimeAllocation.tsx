import { useMemo } from 'react';
import { addDays, startOfWeek } from 'date-fns';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { ECharts } from '@/components/charts/ECharts';

// Распределение задач недели по тайм-блокам (реальные данные, цвета как в Плане/Календаре).
const SEGMENTS = [
  { key: 'morning', label: 'Утро', color: '#f59e0b' },
  { key: 'day', label: 'День', color: '#6366f1' },
  { key: 'evening', label: 'Вечер', color: '#8b5cf6' },
  { key: 'night', label: 'Ночь', color: '#3b82f6' },
  { key: 'none', label: 'Без блока', color: '#94a3b8' },
] as const;

export const TimeAllocation: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks } = useStore();

  const { data, total } = useMemo(() => {
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    const days = new Set(Array.from({ length: 7 }, (_, i) => isoDate(addDays(ws, i))));
    const wk = tasks.filter((t) => days.has(t.date) && !t.parent_id);
    const counts: Record<string, number> = {};
    wk.forEach((t) => {
      const k = (t.time_block as string) ?? 'none';
      counts[k] = (counts[k] ?? 0) + 1;
    });
    const data = SEGMENTS
      .map((s) => ({ name: s.label, value: counts[s.key] ?? 0, itemStyle: { color: s.color } }))
      .filter((d) => d.value > 0);
    return { data, total: wk.length };
  }, [tasks, date]);

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
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <h3 className="text-base font-semibold text-text mb-2">Распределение времени</h3>
      {total === 0 ? (
        <div className="flex h-[200px] items-center justify-center text-xs text-text-muted">Нет задач на этой неделе</div>
      ) : (
        <div className="relative">
          <ECharts option={option} height={200} />
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold tabular-nums text-text leading-none">{total}</div>
            <div className="text-[11px] text-text-muted mt-0.5">задач</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {data.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5 text-xs text-text-muted">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.itemStyle.color }} />
                <span>{d.name}</span>
                <span className="tabular-nums text-text font-medium">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
