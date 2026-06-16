import { useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Ring } from '@/components/ui/ring';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { useStore } from '@/lib/store';
import { ECharts } from '@/components/charts/ECharts';
import { forecast as runForecast, type ForecastMethod } from '@/lib/forecast';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { isoDate, fmtNum } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { getChartColors, type ChartColors } from '@/lib/chart-theme';

export const AnalyticsPage = () => {
  const { goals, progress, tasks, habits, habitLogs, reflections, timeEntries } = useStore();
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

  // Radar — баланс жизни по 6 осям (0..100)
  const radar = useMemo(() => {
    const last30 = Array.from({ length: 30 }, (_, i) => isoDate(addDays(new Date(), -i)));
    // Продуктивность: доля выполненных задач
    const dt = tasks.filter((t) => last30.includes(t.date));
    const productivity = dt.length ? Math.round((dt.filter((t) => t.status === 'done').length / dt.length) * 100) : 0;
    // Постоянство: средняя доля привычек
    const habitRatio = habits.length
      ? Math.round((habits.reduce((s, h) => {
          const cnt = last30.filter((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d)).length;
          return s + cnt / 30;
        }, 0) / habits.length) * 100)
      : 0;
    // Настроение
    const moods = reflections.filter((r) => last30.includes(r.date) && r.mood !== null).map((r) => r.mood as number);
    const mood = moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length / 4) * 100) : 0;
    // Фокус: pomodoro дни
    const focusDays = new Set(timeEntries.filter((e) => e.type === 'pomodoro' && e.duration >= 25 * 60).map((e) => isoDate(new Date(e.started_at)))).size;
    const focus = Math.min(100, Math.round((focusDays / 30) * 100 * 2));
    // Цели: средний прогресс
    const goalsAvg = goals.length
      ? Math.round((goals.reduce((s, g) => {
          const denom = g.target_value - g.start_value || 1;
          return s + Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
        }, 0) / goals.length) * 100)
      : 0;
    // Рефлексия: дней с рефлексией
    const reflDays = reflections.filter((r) => last30.includes(r.date) && r.mood !== null).length;
    const reflection = Math.min(100, Math.round((reflDays / 30) * 100));
    return [
      { axis: 'Продуктивность', value: productivity },
      { axis: 'Постоянство', value: habitRatio },
      { axis: 'Настроение', value: mood },
      { axis: 'Фокус', value: focus },
      { axis: 'Цели', value: goalsAvg },
      { axis: 'Рефлексия', value: reflection },
    ];
  }, [tasks, habits, habitLogs, reflections, timeEntries, goals]);

  // Distribution — гистограмма дневной доли выполнения задач за 60 дней (бины 0-20-40-60-80-100)
  const distribution = useMemo(() => {
    const days = Array.from({ length: 60 }, (_, i) => isoDate(addDays(new Date(), -i)));
    const bins = [0, 0, 0, 0, 0];
    days.forEach((d) => {
      const dt = tasks.filter((t) => t.date === d);
      if (dt.length === 0) return;
      const r = dt.filter((t) => t.status === 'done').length / dt.length;
      const idx = Math.min(4, Math.floor(r * 5));
      bins[idx]++;
    });
    return bins;
  }, [tasks]);

  // KPI-ряд за неделю со спарклайнами
  const kpis = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(new Date(), -6 + i)));
    const focusSeries = days.map((d) => {
      const dt = tasks.filter((t) => t.date === d);
      return dt.length ? Math.round((dt.filter((t) => t.status === 'done').length / dt.length) * 100) : 0;
    });
    const deepSeries = days.map((d) =>
      Math.round(timeEntries.filter((e) => e.type === 'pomodoro' && isoDate(new Date(e.started_at)) === d).reduce((s, e) => s + e.duration, 0) / 60));
    const doneSeries = days.map((d) => tasks.filter((t) => t.date === d && t.status === 'done').length);
    const prodSeries = focusSeries;

    const last = (a: number[]) => a[a.length - 1] ?? 0;
    const prev = (a: number[]) => a[a.length - 2] ?? 0;
    const delta = (a: number[]) => { const p = prev(a); return p ? Math.round(((last(a) - p) / p) * 100) : null; };

    return {
      focus: { value: last(focusSeries), delta: delta(focusSeries), series: focusSeries },
      deep: { value: last(deepSeries), delta: delta(deepSeries), series: deepSeries },
      done: { value: doneSeries.reduce((s, x) => s + x, 0), delta: delta(doneSeries), series: doneSeries },
      prod: { value: Math.round(prodSeries.reduce((s, x) => s + x, 0) / 7), delta: delta(prodSeries), series: prodSeries },
    };
  }, [tasks, timeEntries]);

  // Распределение времени по целям (из time_entries за 30 дней)
  const timeDistribution = useMemo(() => {
    const last30 = new Set(Array.from({ length: 30 }, (_, i) => isoDate(addDays(new Date(), -i))));
    const byGoal = new Map<string, number>();
    let free = 0;
    timeEntries.forEach((e) => {
      if (!last30.has(isoDate(new Date(e.started_at))) || e.duration <= 0) return;
      if (e.goal_id) byGoal.set(e.goal_id, (byGoal.get(e.goal_id) ?? 0) + e.duration);
      else free += e.duration;
    });
    const palette = ['#6366f1', '#8b5cf6', '#22c55e', '#f59e0b', '#ec4899', '#06b6d4'];
    const items = Array.from(byGoal.entries())
      .map(([gid, sec]) => ({ name: goals.find((g) => g.id === gid)?.title ?? 'Цель', value: Math.round(sec / 60) }))
      .sort((a, b) => b.value - a.value);
    if (free > 0) items.push({ name: 'Свободный фокус', value: Math.round(free / 60) });
    return items.slice(0, 6).map((it, i) => ({ ...it, color: palette[i % palette.length] }));
  }, [timeEntries, goals]);

  // Top-категории по тегам задач (за 60 дней)
  const topCategories = useMemo(() => {
    const last60 = new Set(Array.from({ length: 60 }, (_, i) => isoDate(addDays(new Date(), -i))));
    const counts = new Map<string, { total: number; done: number }>();
    tasks.forEach((t) => {
      if (!last60.has(t.date)) return;
      const tags = (t.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean);
      const cats = tags.length ? tags : ['без тега'];
      cats.forEach((c) => {
        const cur = counts.get(c) ?? { total: 0, done: 0 };
        cur.total++;
        if (t.status === 'done') cur.done++;
        counts.set(c, cur);
      });
    });
    return Array.from(counts.entries())
      .map(([name, v]) => ({ name, total: v.total, done: v.done, pct: v.total ? Math.round((v.done / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6);
  }, [tasks]);

  // Weekly consistency: 12 недель × 7 дней, доля выполнения
  const consistency = useMemo(() => {
    const weeks = 12;
    const start = addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), -7 * (weeks - 1));
    const grid: { ratio: number; date: string }[][] = [];
    for (let w = 0; w < weeks; w++) {
      const row: { ratio: number; date: string }[] = [];
      for (let d = 0; d < 7; d++) {
        const date = isoDate(addDays(start, w * 7 + d));
        const dt = tasks.filter((t) => t.date === date);
        row.push({ ratio: dt.length ? dt.filter((t) => t.status === 'done').length / dt.length : -1, date });
      }
      grid.push(row);
    }
    return grid;
  }, [tasks]);

  return (
    <div className="p-4 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-h1 flex-1">Аналитика</h1>
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

      {/* KPI-ряд */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <MetricCard label="Фокус-скор" value={kpis.focus.value} suffix="%" delta={kpis.focus.delta} data={kpis.focus.series} color="#6366f1" />
        <MetricCard label="Глубокая работа" value={kpis.deep.value} suffix=" мин" delta={kpis.deep.delta} data={kpis.deep.series} color="#8b5cf6" />
        <MetricCard label="Задач за неделю" value={kpis.done.value} delta={kpis.done.delta} data={kpis.done.series} color="#22c55e" />
        <MetricCard label="Продуктивность" value={kpis.prod.value} suffix="%" delta={kpis.prod.delta} data={kpis.prod.series} color="#f59e0b" />
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
              data: habitsBar.map((h) => {
                const hue = Math.round((Math.max(0, Math.min(7, h.done)) / 7) * 130);
                return { value: h.done, itemStyle: { color: `hsl(${hue} 70% 50%)` } };
              }),
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
            series: [{ type: 'heatmap', data: heat.data, progressive: 0 }],
          }} />
        </Card>

        {/* Radar — баланс жизни */}
        <Card className="sm:col-span-2 lg:col-span-5">
          <CardTitle>Баланс по сферам</CardTitle>
          <div className="text-[11px] text-text-muted mb-2">За последние 30 дней</div>
          <ECharts height={300} option={{
            tooltip: {},
            radar: {
              indicator: radar.map((r) => ({ name: r.axis, max: 100 })),
              radius: '65%',
              axisName: { color: cc.axis, fontSize: 11 },
              splitLine: { lineStyle: { color: cc.splitLine } },
              splitArea: { areaStyle: { color: ['transparent', 'rgba(99,102,241,0.04)'] } },
              axisLine: { lineStyle: { color: cc.splitLine } },
            },
            series: [{
              type: 'radar',
              data: [{
                value: radar.map((r) => r.value),
                name: 'Текущий баланс',
                areaStyle: { color: 'rgba(99,102,241,0.25)' },
                lineStyle: { color: '#6366f1', width: 2 },
                itemStyle: { color: '#6366f1' },
              }],
            }],
          }} />
        </Card>

        {/* Distribution — гистограмма дней по выполнению */}
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardTitle>Распределение дней</CardTitle>
          <div className="text-[11px] text-text-muted mb-2">Сколько дней попадали в диапазон выполнения (60 дней)</div>
          <ECharts height={280} option={{
            tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
            grid: { left: 30, right: 10, top: 10, bottom: 30 },
            xAxis: {
              type: 'category',
              data: ['0–20%', '20–40%', '40–60%', '60–80%', '80–100%'],
              axisLabel: { color: cc.axis, fontSize: 10 },
              axisLine: { lineStyle: { color: cc.axisLine } },
            },
            yAxis: {
              type: 'value', axisLabel: { color: cc.axis },
              splitLine: { lineStyle: { color: cc.splitLine } },
              axisLine: { show: false }, axisTick: { show: false },
            },
            series: [{
              type: 'bar', barWidth: '55%',
              data: distribution.map((v, i) => ({
                value: v,
                itemStyle: { color: `hsl(${Math.round((i / 4) * 130)} 70% 55%)`, borderRadius: [6, 6, 0, 0] },
              })),
            }],
          }} />
        </Card>

        {/* Confidence — прогноз с диапазоном ETA */}
        {goal && f && (
          <Card className="sm:col-span-2 lg:col-span-3 flex flex-col justify-center">
            <CardTitle>Диапазон достижения</CardTitle>
            <div className="text-[11px] text-text-muted mb-3">95% доверительный интервал</div>
            {f.etaDate ? (
              <div className="space-y-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-text">{f.etaDate}</div>
                  <div className="text-[11px] text-text-muted">ожидаемая дата</div>
                </div>
                <div className="relative h-2 rounded-full bg-bg-soft overflow-hidden">
                  <div className="absolute inset-y-0 left-[15%] right-[15%] bg-accent/30" />
                  <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-accent" />
                </div>
                <div className="flex justify-between text-[10px] text-text-muted">
                  <span>оптимистично</span>
                  <span>вероятно</span>
                  <span>пессимистично</span>
                </div>
                <div className="text-center text-xs text-text-muted">
                  точность модели: <b className="text-text">{Math.round(f.etaConfidence * 100)}%</b>
                </div>
              </div>
            ) : (
              <div className="text-xs text-text-dim text-center py-4">Недостаточно данных для прогноза. Записывайте прогресс цели.</div>
            )}
          </Card>
        )}

        {/* Распределение времени — donut */}
        <Card className="sm:col-span-1 lg:col-span-4">
          <CardTitle>Распределение времени</CardTitle>
          <div className="text-[11px] text-text-muted mb-2">По целям, за 30 дней</div>
          {timeDistribution.length === 0 ? (
            <div className="text-xs text-text-dim py-8 text-center">Нет залогированного времени. Запускайте Pomodoro/Focus.</div>
          ) : (
            <ECharts height={240} option={{
              tooltip: { trigger: 'item', formatter: '{b}: {c} мин ({d}%)', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
              legend: { bottom: 0, textStyle: { color: cc.axis, fontSize: 11 }, icon: 'circle' },
              series: [{
                type: 'pie', radius: ['52%', '74%'], center: ['50%', '42%'],
                avoidLabelOverlap: true,
                itemStyle: { borderColor: cc.tooltipBg, borderWidth: 2 },
                label: { show: false },
                data: timeDistribution.map((d) => ({ name: d.name, value: d.value, itemStyle: { color: d.color } })),
              }],
            }} />
          )}
        </Card>

        {/* Top-категории */}
        <Card className="sm:col-span-1 lg:col-span-4">
          <CardTitle>Топ категорий</CardTitle>
          <div className="text-[11px] text-text-muted mb-3">По тегам задач, за 60 дней</div>
          <div className="space-y-2.5">
            {topCategories.length === 0 && <div className="text-xs text-text-dim">Нет данных</div>}
            {topCategories.map((c) => (
              <div key={c.name}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text truncate">#{c.name}</span>
                  <span className="text-text-muted tabular-nums text-xs">{c.done}/{c.total} · {c.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-bg-soft overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.pct}%`, background: 'linear-gradient(90deg,#8b5cf6,#6366f1)' }} />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Weekly consistency heatmap */}
        <Card className="sm:col-span-2 lg:col-span-4">
          <CardTitle>Постоянство по неделям</CardTitle>
          <div className="text-[11px] text-text-muted mb-3">Доля выполнения задач, 12 недель</div>
          <div className="flex gap-1 overflow-x-auto">
            {consistency.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell, di) => {
                  const empty = cell.ratio < 0;
                  const hue = empty ? null : Math.round(cell.ratio * 130);
                  return (
                    <div
                      key={di}
                      className="h-4 w-4 rounded-[3px]"
                      style={{ background: empty ? 'var(--bg-soft)' : `hsl(${hue} 65% 50%)` }}
                      title={`${cell.date}${empty ? '' : ` · ${Math.round(cell.ratio * 100)}%`}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3 text-[10px] text-text-muted">
            <span>меньше</span>
            <div className="flex gap-0.5">
              {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                <div key={r} className="h-3 w-3 rounded-[2px]" style={{ background: `hsl(${Math.round(r * 130)} 65% 50%)` }} />
              ))}
            </div>
            <span>больше</span>
          </div>
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
