import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { computeInsights } from '@/lib/insights';
import { useTheme } from '@/lib/theme';
import { ECharts } from '@/components/charts/ECharts';
import { Sparkles, ArrowRight } from 'lucide-react';

const TONE_BG: Record<string, string> = {
  positive: 'bg-success/10',
  warning: 'bg-danger/10',
  neutral: 'bg-bg-soft',
  info: 'bg-accent/10',
};

/** Распределение задач по часам дня (06–23) для мини-графика ритма */
function hourlyLoad(tasks: { start_time: string | null; time_block: string | null }[]): number[] {
  const buckets = Array.from({ length: 18 }, () => 0); // 06:00..23:00
  const blockCenter: Record<string, number> = { morning: 9, day: 14, evening: 18, night: 21 };
  for (const t of tasks) {
    let h: number | null = null;
    if (t.start_time) h = Number(t.start_time.slice(0, 2));
    else if (t.time_block && blockCenter[t.time_block] != null) h = blockCenter[t.time_block];
    if (h != null && h >= 6 && h <= 23) buckets[h - 6] += 1;
  }
  return buckets;
}

export const DayBrief: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { theme } = useTheme();
  const { tasks, habits, habitLogs, reflections, timeEntries, goals, progress } = useStore();
  const accent = theme === 'dark' ? '#818cf8' : '#6366f1';

  const insights = useMemo(
    () => computeInsights({ today: date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress }).slice(0, 3),
    [date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress],
  );

  const todayIso = date.toISOString().slice(0, 10);

  const headline = useMemo(() => {
    const dt = tasks.filter((t) => t.date === todayIso && !t.parent_id);
    const ratio = dt.length ? dt.filter((t) => t.status === 'done').length / dt.length : 0;
    if (ratio >= 0.7) return 'Отличный темп — день под контролем.';
    if (ratio >= 0.3) return 'Хороший день, продолжай по плану.';
    return 'Высокий шанс выиграть день. Начни с главного.';
  }, [tasks, todayIso]);

  const load = useMemo(
    () => hourlyLoad(tasks.filter((t) => t.date === todayIso && !t.parent_id)),
    [tasks, todayIso],
  );
  const hasLoad = load.some((v) => v > 0);
  const nowIdx = Math.min(17, Math.max(0, new Date().getHours() - 6));

  const chartOpt = {
    grid: { left: 4, right: 8, top: 10, bottom: 4 },
    xAxis: {
      type: 'category',
      data: Array.from({ length: 18 }, (_, i) => `${i + 6}:00`),
      show: false,
      boundaryGap: false,
    },
    yAxis: { type: 'value', show: false, max: (v: { max: number }) => Math.max(2, v.max) },
    tooltip: {
      trigger: 'axis',
      formatter: (p: { name: string; value: number }[]) => `${p[0].name} · задач: ${p[0].value}`,
    },
    series: [{
      type: 'line',
      smooth: 0.5,
      data: load,
      symbol: 'circle',
      symbolSize: (_v: number, p: { dataIndex: number }) => (p.dataIndex === nowIdx ? 9 : 5),
      itemStyle: { color: accent },
      lineStyle: { width: 2, color: accent },
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: theme === 'dark' ? 'rgba(129,140,248,0.25)' : 'rgba(99,102,241,0.14)' },
            { offset: 1, color: 'rgba(99,102,241,0)' },
          ],
        },
      },
    }],
  };

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border shadow-card p-5 flex flex-col overflow-hidden">
      {/* Заголовок */}
      <div className="flex items-center gap-2 mb-2.5 shrink-0">
        <span className="flex items-center gap-1.5 text-label text-accent">
          <Sparkles className="h-3.5 w-3.5" /> Сводка дня
        </span>
        <span className="px-1.5 py-0.5 rounded-full bg-accent/10 text-accent text-[9px] font-bold tracking-wider">БЕТА</span>
      </div>

      <div className="text-h3 text-text leading-snug mb-3 shrink-0 line-clamp-2">{headline}</div>

      {/* Тело: инсайты слева, ритм дня справа */}
      <div className="flex-1 min-h-0 flex gap-4">
        <div className="flex-1 min-w-0 space-y-2.5 overflow-hidden">
          {insights.length === 0 ? (
            <div className="text-sm text-text-muted">Поработай несколько дней — появятся наблюдения о твоём ритме.</div>
          ) : (
            insights.map((ins) => (
              <button
                key={ins.id}
                onClick={() => ins.link && nav(ins.link)}
                className="w-full flex items-center gap-3 text-left group"
              >
                <span className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-base ${TONE_BG[ins.tone] ?? 'bg-bg-soft'}`}>
                  {ins.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-text leading-snug truncate group-hover:text-accent transition-colors duration-base">
                    {ins.title}
                  </div>
                  <div className="text-xs text-text-muted leading-snug truncate">{ins.body}</div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Ритм дня: распределение задач по часам */}
        <div className="w-[44%] shrink-0 min-h-0 hidden sm:block" title="Распределение задач по часам">
          {hasLoad ? (
            <ECharts option={chartOpt} height="100%" />
          ) : (
            <div className="h-full flex items-center justify-center text-xs text-text-dim text-center px-2">
              Добавь задачам время — увидишь ритм дня
            </div>
          )}
        </div>
      </div>

      {/* Футер */}
      <button
        onClick={() => nav('/analytics')}
        className="mt-3 shrink-0 flex items-center gap-1.5 text-sm font-medium text-accent hover:gap-2.5 transition-all duration-base self-start"
      >
        Полный анализ <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
};
