import { useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Ring } from '@/components/ui/ring';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { ECharts } from '@/components/charts/ECharts';
import { forecastGoal } from '@/lib/predict';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { isoDate, fmtNum } from '@/lib/utils';

export const AnalyticsPage = () => {
  const { goals, progress, tasks, habits, habitLogs } = useStore();
  const [goalId, setGoalId] = useState<string>(goals[0]?.id ?? '');
  const [scenario, setScenario] = useState<'as-is' | 'plus20' | 'plus50' | 'minus20'>('as-is');
  const goal = goals.find((g) => g.id === goalId);
  const recs = useMemo(() => progress.filter((p) => p.goal_id === goalId), [progress, goalId]);

  const multiplier = { 'as-is': 1, plus20: 1.2, plus50: 1.5, minus20: 0.8 }[scenario];
  const f = useMemo(() => goal ? forecastGoal(goal, recs, 60, multiplier) : null, [goal, recs, multiplier]);

  // task heatmap: 12 weeks x 7
  const heat = useMemo(() => {
    const today = new Date();
    const weeks = 12;
    const start = addDays(startOfWeek(today, { weekStartsOn: 1 }), -7 * (weeks - 1));
    const data: [number, number, number][] = [];
    for (let w = 0; w < weeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = isoDate(addDays(start, w * 7 + d));
        const count = tasks.filter((t) => t.date === date && t.status === 'done').length;
        data.push([w, d, count]);
      }
    }
    const max = Math.max(1, ...data.map((x) => x[2]));
    return { data, max, weeks };
  }, [tasks]);

  // habits weekly bar
  const habitsBar = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), i)));
    return habits.map((h) => ({
      title: h.title,
      done: days.filter((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d)).length,
      target: 7,
    }));
  }, [habits, habitLogs]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Аналитика</h1>
        <div className="flex gap-2">
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Цель" /></SelectTrigger>
            <SelectContent>
              {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={scenario} onValueChange={(v: any) => setScenario(v)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="as-is">Текущий темп</SelectItem>
              <SelectItem value="plus20">+20% активности</SelectItem>
              <SelectItem value="plus50">+50% активности</SelectItem>
              <SelectItem value="minus20">−20% активности</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {goal && f && (
        <Card>
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="mb-0">Динамика и прогноз</CardTitle>
            <div className="flex items-center gap-3 text-xs text-text-muted">
              <Badge tone="info">прогноз</Badge>
              <span>скорость: <b className="text-text">{fmtNum(f.velocity, 3)}</b> ед./день</span>
              {f.etaDate && <span>ETA: <b className="text-text">{f.etaDate}</b></span>}
              <span>точность: <b className="text-text">{Math.round(f.etaConfidence * 100)}%</b></span>
            </div>
          </div>
          <ECharts height={340} option={mainChart(goal, recs, f)} />
        </Card>
      )}

      <div className="grid grid-cols-12 gap-4">
        <Card className="col-span-3 flex flex-col items-center justify-center">
          <CardTitle>Прогресс цели</CardTitle>
          {goal && (
            <Ring
              value={Math.round(((goal.current_value - goal.start_value) / (goal.target_value - goal.start_value || 1)) * 100)}
              size={160}
              stroke={12}
            >
              <div className="text-center">
                <div className="text-3xl font-semibold">{fmtNum(goal.current_value, 1)}</div>
                <div className="text-[11px] text-text-muted">из {fmtNum(goal.target_value, 0)}{goal.unit ? ` ${goal.unit}` : ''}</div>
              </div>
            </Ring>
          )}
        </Card>

        <Card className="col-span-5">
          <CardTitle>Привычки за неделю</CardTitle>
          <ECharts height={240} option={{
            grid: { left: 100, right: 20, top: 10, bottom: 24 },
            xAxis: { type: 'value', max: 7, axisLabel: { color: '#a3a3a3' }, splitLine: { lineStyle: { color: '#1f1f1f' } } },
            yAxis: { type: 'category', data: habitsBar.map((h) => h.title), axisLabel: { color: '#a3a3a3' }, axisLine: { lineStyle: { color: '#262626' } } },
            series: [{
              type: 'bar', barWidth: 14,
              data: habitsBar.map((h) => ({ value: h.done, itemStyle: { color: '#22c55e', borderRadius: [0, 4, 4, 0] } })),
              markLine: { silent: true, symbol: 'none', data: [{ xAxis: 7, lineStyle: { color: '#a3a3a3', type: 'dashed' } }] },
            }],
          }} />
        </Card>

        <Card className="col-span-4">
          <CardTitle>Тепловая карта выполнения</CardTitle>
          <ECharts height={240} option={{
            tooltip: { position: 'top' },
            grid: { left: 30, right: 10, top: 10, bottom: 20 },
            xAxis: { type: 'category', data: Array.from({ length: heat.weeks }, (_, i) => `н${i + 1}`), splitArea: { show: true }, axisLabel: { color: '#a3a3a3', fontSize: 10 } },
            yAxis: { type: 'category', data: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'], splitArea: { show: true }, axisLabel: { color: '#a3a3a3', fontSize: 10 } },
            visualMap: { min: 0, max: heat.max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, show: false, inRange: { color: ['#1a1a1a', '#16a34a', '#22c55e'] } },
            series: [{ type: 'heatmap', data: heat.data, itemStyle: { borderRadius: 2 }, progressive: 0 }],
          }} />
        </Card>
      </div>
    </div>
  );
};

function mainChart(goal: any, recs: any[], f: any) {
  const histDates = recs.map((r) => r.date);
  const histVals = recs.map((r) => r.value);
  const fcDates = f.forecast.map((p: any) => p.date);
  const fcExp = f.forecast.map((p: any) => p.expected);
  const fcLow = f.forecast.map((p: any) => p.low);
  const fcHigh = f.forecast.map((p: any) => p.high);
  const xs = [...histDates, ...fcDates];
  return {
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis', backgroundColor: '#141414', borderColor: '#262626', textStyle: { color: '#fafafa' } },
    legend: { textStyle: { color: '#a3a3a3' }, top: 0, right: 10 },
    xAxis: {
      type: 'category', data: xs, axisLabel: { color: '#a3a3a3' },
      axisLine: { lineStyle: { color: '#262626' } },
    },
    yAxis: {
      type: 'value', axisLabel: { color: '#a3a3a3' },
      splitLine: { lineStyle: { color: '#1f1f1f' } },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [
      {
        name: 'История', type: 'line', smooth: true, showSymbol: false,
        data: [...histVals, ...new Array(fcDates.length).fill(null)],
        lineStyle: { color: '#22c55e', width: 2.5 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(34,197,94,0.3)' }, { offset: 1, color: 'rgba(34,197,94,0)' }] } },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: '#fafafa', type: 'dashed', opacity: 0.5 }, data: [{ yAxis: goal.target_value, label: { color: '#fafafa', formatter: 'цель' } }] },
      },
      {
        name: 'Прогноз', type: 'line', smooth: true, showSymbol: false,
        data: [...new Array(histVals.length).fill(null), ...fcExp],
        lineStyle: { color: '#3b82f6', width: 2, type: 'dashed' },
      },
      {
        name: 'нижняя', type: 'line', smooth: true, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'ci', symbol: 'none',
        data: [...new Array(histVals.length).fill(null), ...fcLow], legendHoverLink: false,
      },
      {
        name: 'диапазон', type: 'line', smooth: true, showSymbol: false, lineStyle: { opacity: 0 }, stack: 'ci', symbol: 'none',
        areaStyle: { color: 'rgba(59,130,246,0.2)' },
        data: [...new Array(histVals.length).fill(null), ...fcHigh.map((h: number, i: number) => h - fcLow[i])],
      },
    ],
  };
}
