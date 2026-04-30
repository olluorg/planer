import { useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Ring } from '@/components/ui/ring';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { ECharts } from '@/components/charts/ECharts';
import { forecast as runForecast, type ForecastMethod } from '@/lib/forecast';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { isoDate, fmtNum } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { getChartColors, type ChartColors } from '@/lib/chart-theme';

export const AnalyticsPage = () => {
  const { goals, progress, tasks, habits, habitLogs, reflections } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const [goalId, setGoalId] = useState<string>(goals[0]?.id ?? '');
  const [method, setMethod] = useState<ForecastMethod>('linreg');
  const [activity, setActivity] = useState<number>(100); // % activity slider 50..200
  const goal = goals.find((g) => g.id === goalId);
  const recs = useMemo(() => progress.filter((p) => p.goal_id === goalId), [progress, goalId]);

  const multiplier = activity / 100;
  const f = useMemo(() => goal ? runForecast(goal, recs, { horizon: 60, multiplier, method }) : null, [goal, recs, multiplier, method]);

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

  // habit correlations vs mood and task completion
  const correlations = useMemo(() => {
    if (habits.length === 0) return [];
    const today = new Date();
    const days = Array.from({ length: 60 }, (_, i) => isoDate(addDays(today, -59 + i)));

    const moodByDay = new Map<string, number>();
    reflections.forEach((r) => { if (r.mood !== null) moodByDay.set(r.date, r.mood); });
    const taskRatioByDay = new Map<string, number>();
    days.forEach((d) => {
      const dt = tasks.filter((t) => t.date === d);
      taskRatioByDay.set(d, dt.length ? dt.filter((t) => t.status === 'done').length / dt.length : 0);
    });

    return habits.map((h) => {
      const habitVec = days.map((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d) ? 1 : 0);
      const moodVec: number[] = [];
      const moodHabit: number[] = [];
      const taskVec: number[] = [];
      days.forEach((d, i) => {
        if (moodByDay.has(d)) { moodHabit.push(habitVec[i]); moodVec.push(moodByDay.get(d)!); }
        taskVec.push(taskRatioByDay.get(d) ?? 0);
      });
      return {
        title: h.title,
        rMood: pearson(moodHabit, moodVec),
        rTasks: pearson(habitVec, taskVec),
      };
    });
  }, [habits, habitLogs, tasks, reflections]);

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
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-semibold flex-1">Аналитика</h1>
        <div className="flex flex-wrap gap-2">
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Цель" /></SelectTrigger>
            <SelectContent>
              {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={(v: any) => setMethod(v)}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Модель" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="linreg">Лин. регрессия</SelectItem>
              <SelectItem value="ema">EMA (сглаживание)</SelectItem>
              <SelectItem value="holt">Holt (тренд)</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 border border-border px-3 py-1.5 text-xs">
            <span className="text-text-muted">Активность</span>
            <input
              type="range" min={50} max={200} step={5}
              value={activity}
              onChange={(e) => setActivity(Number(e.target.value))}
              className="w-32 accent-accent"
            />
            <span className="tabular-nums w-12 text-right">{activity}%</span>
          </div>
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
          <ECharts height={340} option={mainChart(goal, recs, f, cc)} />
        </Card>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-4">
        <Card className="sm:col-span-2 lg:col-span-3 flex flex-col items-center justify-center">
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

        <Card className="lg:col-span-5">
          <CardTitle>Привычки за неделю</CardTitle>
          <ECharts height={240} option={{
            grid: { left: 100, right: 20, top: 10, bottom: 24 },
            xAxis: { type: 'value', max: 7, axisLabel: { color: cc.axis }, splitLine: { lineStyle: { color: cc.splitLine } } },
            yAxis: { type: 'category', data: habitsBar.map((h) => h.title), axisLabel: { color: cc.axis }, axisLine: { lineStyle: { color: cc.axisLine } } },
            series: [{
              type: 'bar', barWidth: 14,
              data: habitsBar.map((h) => ({ value: h.done, itemStyle: { color: '#22c55e', borderRadius: [0, 4, 4, 0] } })),
              markLine: { silent: true, symbol: 'none', data: [{ xAxis: 7, lineStyle: { color: cc.axis, type: 'dashed' } }] },
            }],
          }} />
        </Card>

        <Card className="sm:col-span-2 lg:col-span-4">
          <CardTitle>Корреляции привычек</CardTitle>
          <div className="text-[11px] text-text-muted mb-2">Pearson R за 60 дней</div>
          <div className="space-y-2 text-sm">
            {correlations.length === 0 && <div className="text-xs text-text-dim">Нет привычек</div>}
            {correlations.map((c) => (
              <div key={c.title} className="flex items-center gap-3">
                <div className="flex-1 truncate">{c.title}</div>
                <CorrCell label="настр." value={c.rMood} />
                <CorrCell label="задачи" value={c.rTasks} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="sm:col-span-2 lg:col-span-4">
          <CardTitle>Тепловая карта выполнения</CardTitle>
          <ECharts height={240} option={{
            tooltip: { position: 'top' },
            grid: { left: 30, right: 10, top: 10, bottom: 20 },
            xAxis: { type: 'category', data: Array.from({ length: heat.weeks }, (_, i) => `н${i + 1}`), splitArea: { show: true }, axisLabel: { color: cc.axis, fontSize: 10 } },
            yAxis: { type: 'category', data: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'], splitArea: { show: true }, axisLabel: { color: cc.axis, fontSize: 10 } },
            visualMap: { min: 0, max: heat.max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, show: false, inRange: { color: [cc.heatmapEmpty, '#16a34a', '#22c55e'] } },
            series: [{ type: 'heatmap', data: heat.data, itemStyle: { borderRadius: 2 }, progressive: 0 }],
          }} />
        </Card>
      </div>
    </div>
  );
};

const CorrCell: React.FC<{ label: string; value: number | null }> = ({ label, value }) => {
  if (value === null) return <span className="text-text-dim text-[11px] tabular-nums w-16 text-right">{label}: —</span>;
  const tone = value > 0.4 ? 'text-accent' : value < -0.4 ? 'text-danger' : 'text-text-muted';
  return (
    <span className={`text-[11px] tabular-nums w-16 text-right ${tone}`}>
      {label}: {value > 0 ? '+' : ''}{value.toFixed(2)}
    </span>
  );
};

function pearson(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < 3) return null;
  const ma = a.reduce((s, x) => s + x, 0) / n;
  const mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (a[i] - ma) * (b[i] - mb); da += (a[i] - ma) ** 2; db += (b[i] - mb) ** 2; }
  const den = Math.sqrt(da * db);
  if (!den) return null;
  return num / den;
}

function mainChart(goal: any, recs: any[], f: any, cc: ChartColors) {
  const histDates = recs.map((r) => r.date);
  const histVals = recs.map((r) => r.value);
  const fcDates = f.forecast.map((p: any) => p.date);
  const fcExp = f.forecast.map((p: any) => p.expected);
  const fcLow = f.forecast.map((p: any) => p.low);
  const fcHigh = f.forecast.map((p: any) => p.high);
  const xs = [...histDates, ...fcDates];
  return {
    grid: { left: 50, right: 20, top: 20, bottom: 30 },
    tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
    legend: { textStyle: { color: cc.axis }, top: 0, right: 10 },
    xAxis: {
      type: 'category', data: xs, axisLabel: { color: cc.axis },
      axisLine: { lineStyle: { color: cc.axisLine } },
    },
    yAxis: {
      type: 'value', axisLabel: { color: cc.axis },
      splitLine: { lineStyle: { color: cc.splitLine } },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [
      {
        name: 'История', type: 'line', smooth: true, showSymbol: false,
        data: [...histVals, ...new Array(fcDates.length).fill(null)],
        lineStyle: { color: '#22c55e', width: 2.5 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(34,197,94,0.3)' }, { offset: 1, color: 'rgba(34,197,94,0)' }] } },
        markLine: { silent: true, symbol: 'none', lineStyle: { color: cc.axis, type: 'dashed', opacity: 0.7 }, data: [{ yAxis: goal.target_value, label: { color: cc.axis, formatter: 'цель' } }] },
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
