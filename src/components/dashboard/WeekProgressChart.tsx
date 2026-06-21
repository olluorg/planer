import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { addDays, startOfWeek } from 'date-fns';
import { ECharts } from '@/components/charts/ECharts';

export const WeekProgressChart: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks } = useStore();

  const data = useMemo(() => {
    const ws = startOfWeek(date, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = isoDate(addDays(ws, i));
      const dt = tasks.filter((t) => t.date === d);
      return dt.length ? Math.round((dt.filter((t) => t.status === 'done').length / dt.length) * 100) : 0;
    });
  }, [tasks, date]);

  const today = (new Date(date).getDay() + 6) % 7; // 0=Mon
  const todayValue = data[today];

  const option = {
    grid: { left: 30, right: 10, top: 30, bottom: 28 },
    xAxis: {
      type: 'category',
      data: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
      axisLabel: { color: '#94a3b8', fontSize: 11 },
      axisLine: { lineStyle: { color: 'rgba(15,23,42,0.06)' } },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value', max: 100, min: 0,
      axisLabel: { color: '#94a3b8', fontSize: 11, formatter: '{value}%' },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: 'rgba(15,23,42,0.04)' } },
    },
    series: [{
      type: 'line', smooth: true,
      data,
      lineStyle: { color: '#6366f1', width: 3 },
      itemStyle: { color: '#6366f1' },
      symbol: 'circle', symbolSize: 8,
      areaStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(99,102,241,0.32)' },
            { offset: 1, color: 'rgba(99,102,241,0.0)' },
          ],
        },
      },
      markPoint: {
        symbol: 'circle',
        symbolSize: 14,
        itemStyle: { color: '#6366f1', borderColor: 'white', borderWidth: 3 },
        data: [{ name: 'today', xAxis: today, yAxis: todayValue, value: `${todayValue}%` }],
        label: { show: true, formatter: 'Сегодня\n{c}', color: '#6366f1', fontSize: 11, fontWeight: 600, position: 'top' },
      },
    }],
  };

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <h3 className="text-base font-semibold text-text mb-2">Прогресс на этой неделе</h3>
      <ECharts option={option} height={200} />
    </div>
  );
};
