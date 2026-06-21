import { useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Ring } from '@/components/ui/ring';
import { Badge } from '@/components/ui/badge';
import { MetricCard } from '@/components/ui/metric-card';
import { PageContainer } from '@/components/ui/page-container';
import { useStore } from '@/lib/store';
import { ECharts } from '@/components/charts/ECharts';
import { forecast as runForecast, type ForecastMethod } from '@/lib/forecast';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { isoDate, fmtNum } from '@/lib/utils';
import { useTheme } from '@/lib/theme';
import { getChartColors, type ChartColors } from '@/lib/chart-theme';

type Tab = 'overview' | 'focus' | 'tasks' | 'habits' | 'goals';

export const AnalyticsPage = () => {
  const { goals, progress, tasks, habits, habitLogs, reflections, timeEntries } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const [tab, setTab] = useState<Tab>('overview');
  const [period, setPeriod] = useState<number>(7);
  const [goalId, setGoalId] = useState<string>(goals[0]?.id ?? '');
  const [method, setMethod] = useState<ForecastMethod>('linreg');
  const [activity, setActivity] = useState<number>(100); // % activity slider 50..200
  const goal = goals.find((g) => g.id === goalId);
  const recs = useMemo(() => progress.filter((p) => p.goal_id === goalId), [progress, goalId]);

  const multiplier = activity / 100;
  const f = useMemo(() => goal ? runForecast(goal, recs, { horizon: 60, multiplier, method }) : null, [goal, recs, multiplier, method]);

  // KPI-ряд + тренд за выбранный период
  const kpis = useMemo(() => {
    const n = period;
    const dayList = Array.from({ length: n }, (_, i) => isoDate(addDays(new Date(), -(n - 1) + i)));
    const labels = dayList.map((d) => format(new Date(d), n <= 7 ? 'EEEEEE' : 'd.MM', { locale: ru }));
    const focusSeries = dayList.map((d) => {
      const dt = tasks.filter((t) => t.date === d);
      return dt.length ? Math.round((dt.filter((t) => t.status === 'done').length / dt.length) * 100) : 0;
    });
    const deepSeries = dayList.map((d) =>
      Math.round(timeEntries.filter((e) => e.type === 'pomodoro' && isoDate(new Date(e.started_at)) === d).reduce((s, e) => s + e.duration, 0) / 60));
    const doneSeries = dayList.map((d) => tasks.filter((t) => t.date === d && t.status === 'done').length);
    const prodSeries = dayList.map((d) => {
      const dt = tasks.filter((t) => t.date === d);
      return dt.length && dt.some((t) => t.status === 'done') ? 100 : 0;
    });

    const avg = (a: number[]) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length) : 0);
    const sum = (a: number[]) => a.reduce((s, x) => s + x, 0);
    const last = (a: number[]) => a[a.length - 1] ?? 0;
    const prev = (a: number[]) => a[a.length - 2] ?? 0;
    const delta = (a: number[]) => { const p = prev(a); return p ? Math.round(((last(a) - p) / p) * 100) : null; };

    return {
      labels,
      focus: { value: avg(focusSeries), delta: delta(focusSeries), series: focusSeries },
      deep: { delta: delta(deepSeries), series: deepSeries },
      deepHours: Math.round((sum(deepSeries) / 60) * 10) / 10,
      done: { value: sum(doneSeries), delta: delta(doneSeries), series: doneSeries },
      prod: { value: avg(prodSeries), delta: delta(prodSeries), series: prodSeries },
    };
  }, [tasks, timeEntries, period]);

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
  const timeTotalMin = timeDistribution.reduce((s, x) => s + x.value, 0);

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
    const dt = tasks.filter((t) => last30.includes(t.date));
    const productivity = dt.length ? Math.round((dt.filter((t) => t.status === 'done').length / dt.length) * 100) : 0;
    const habitRatio = habits.length
      ? Math.round((habits.reduce((s, h) => {
          const cnt = last30.filter((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d)).length;
          return s + cnt / 30;
        }, 0) / habits.length) * 100)
      : 0;
    const moods = reflections.filter((r) => last30.includes(r.date) && r.mood !== null).map((r) => r.mood as number);
    const mood = moods.length ? Math.round((moods.reduce((a, b) => a + b, 0) / moods.length / 4) * 100) : 0;
    const focusDays = new Set(timeEntries.filter((e) => e.type === 'pomodoro' && e.duration >= 25 * 60).map((e) => isoDate(new Date(e.started_at)))).size;
    const focus = Math.min(100, Math.round((focusDays / 30) * 100 * 2));
    const goalsAvg = goals.length
      ? Math.round((goals.reduce((s, g) => {
          const denom = g.target_value - g.start_value || 1;
          return s + Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
        }, 0) / goals.length) * 100)
      : 0;
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

  // Distribution — гистограмма дневной доли выполнения задач за 60 дней
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

  // Weekly consistency: 12 недель × 7 дней
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

  const TimeDistributionCard = (
    <Card>
      <CardTitle>Распределение времени</CardTitle>
      <div className="text-caption text-text-muted mb-2">По целям, за 30 дней{timeTotalMin > 0 ? ` · всего ${Math.floor(timeTotalMin / 60)}ч ${timeTotalMin % 60}м` : ''}</div>
      {timeDistribution.length === 0 ? (
        <div className="text-small text-text-dim py-8 text-center">Нет залогированного времени. Запускайте Pomodoro/Focus.</div>
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
  );

  const TopCategoriesCard = (
    <Card>
      <CardTitle>Топ категорий</CardTitle>
      <div className="text-caption text-text-muted mb-3">По тегам задач, за 60 дней</div>
      <div className="space-y-2.5">
        {topCategories.length === 0 && <div className="text-small text-text-dim">Нет данных</div>}
        {topCategories.map((c) => (
          <div key={c.name}>
            <div className="flex justify-between text-small mb-1">
              <span className="text-text truncate">#{c.name}</span>
              <span className="text-text-muted tabular-nums text-caption">{c.done}/{c.total} · {c.pct}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-bg-soft overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${c.pct}%`, background: 'var(--accent)' }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );

  const RadarCard = (
    <Card>
      <CardTitle>Баланс по сферам</CardTitle>
      <div className="text-caption text-text-muted mb-2">За последние 30 дней</div>
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
  );

  const ConsistencyCard = (
    <Card>
      <CardTitle>Постоянство по неделям</CardTitle>
      <div className="text-caption text-text-muted mb-3">Доля выполнения задач, 12 недель</div>
      <div className="flex gap-1.5 justify-center">
        {consistency.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1.5">
            {week.map((cell, di) => {
              const empty = cell.ratio < 0;
              return (
                <div
                  key={di}
                  className="h-6 w-6 rounded-md"
                  style={{ background: empty ? 'var(--bg-soft)' : consistencyColor(cell.ratio), boxShadow: 'inset 0 0 0 1px var(--border-soft)' }}
                  title={`${cell.date}${empty ? '' : ` · ${Math.round(cell.ratio * 100)}%`}`}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center gap-2 mt-4 text-caption text-text-muted">
        <span>меньше</span>
        <div className="h-2 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, #e0e7ff, #a5b4fc, #818cf8, #6366f1, #4338ca)' }} />
        <span>больше</span>
      </div>
    </Card>
  );

  return (
    <PageContainer className="py-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-h1">Аналитика</h1>
        <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v))}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="7">Эта неделя</SelectItem>
            <SelectItem value="30">Этот месяц</SelectItem>
            <SelectItem value="90">Квартал</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="overview">Обзор</TabsTrigger>
          <TabsTrigger value="focus">Фокус</TabsTrigger>
          <TabsTrigger value="tasks">Задачи</TabsTrigger>
          <TabsTrigger value="habits">Привычки</TabsTrigger>
          <TabsTrigger value="goals">Цели</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* ОБЗОР */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="bento-grid-kpi">
            <MetricCard label="Фокус-скор" value={kpis.focus.value} suffix="%" delta={kpis.focus.delta} data={kpis.focus.series} color="#6366f1" />
            <MetricCard label="Глубокая работа" value={kpis.deepHours} suffix=" ч" decimals={1} delta={kpis.deep.delta} data={kpis.deep.series} color="#3b82f6" />
            <MetricCard label="Задач выполнено" value={kpis.done.value} delta={kpis.done.delta} data={kpis.done.series} color="#22c55e" />
            <MetricCard label="Продуктивность" value={kpis.prod.value} suffix="%" delta={kpis.prod.delta} data={kpis.prod.series} color="#f59e0b" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardTitle>Динамика фокус-скора</CardTitle>
              <ECharts height={300} option={trendChart(kpis.focus.series, kpis.labels, cc)} />
            </Card>
            {RadarCard}
          </div>

          <div className="bento-grid">
            {TimeDistributionCard}
            {TopCategoriesCard}
          </div>

          {ConsistencyCard}
        </div>
      )}

      {/* ФОКУС */}
      {tab === 'focus' && (
        <div className="bento-grid">
          {RadarCard}
          {TimeDistributionCard}
        </div>
      )}

      {/* ЗАДАЧИ */}
      {tab === 'tasks' && (
        <div className="space-y-4">
          <div className="bento-grid">
            <Card>
              <CardTitle>Тепловая карта выполнения</CardTitle>
              <ECharts height={240} option={{
                tooltip: { position: 'top' },
                grid: { left: 30, right: 10, top: 10, bottom: 20 },
                xAxis: { type: 'category', data: Array.from({ length: heat.weeks }, (_, i) => `н${i + 1}`), splitArea: { show: true }, axisLabel: { color: cc.axis, fontSize: 10 } },
                yAxis: { type: 'category', data: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'], splitArea: { show: true }, axisLabel: { color: cc.axis, fontSize: 10 } },
                visualMap: { min: 0, max: heat.max, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, show: false, inRange: { color: [cc.heatmapEmpty, '#a5b4fc', '#6366f1'] } },
                series: [{ type: 'heatmap', data: heat.data, progressive: 0 }],
              }} />
            </Card>

            <Card>
              <CardTitle>Распределение дней</CardTitle>
              <div className="text-caption text-text-muted mb-2">Сколько дней попадали в диапазон выполнения (60 дней)</div>
              <ECharts height={240} option={{
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
                  data: distribution.map((v) => ({ value: v, itemStyle: { color: '#6366f1', borderRadius: [6, 6, 0, 0] } })),
                }],
              }} />
            </Card>
          </div>

          {TopCategoriesCard}

          {ConsistencyCard}
        </div>
      )}

      {/* ПРИВЫЧКИ */}
      {tab === 'habits' && (
        <div className="bento-grid">
          <Card>
            <CardTitle>Привычки за неделю</CardTitle>
            <ECharts height={260} option={{
              grid: { left: 100, right: 20, top: 10, bottom: 24 },
              xAxis: { type: 'value', max: 7, axisLabel: { color: cc.axis }, splitLine: { lineStyle: { color: cc.splitLine } } },
              yAxis: { type: 'category', data: habitsBar.map((h) => h.title), axisLabel: { color: cc.axis }, axisLine: { lineStyle: { color: cc.axisLine } } },
              series: [{
                type: 'bar', barWidth: 14,
                data: habitsBar.map((h) => ({ value: h.done, itemStyle: { color: '#6366f1', borderRadius: [0, 4, 4, 0] } })),
                markLine: { silent: true, symbol: 'none', data: [{ xAxis: 7, lineStyle: { color: cc.axis, type: 'dashed' } }] },
              }],
            }} />
          </Card>

          <Card>
            <CardTitle>Корреляции привычек</CardTitle>
            <div className="text-caption text-text-muted mb-2">Pearson R за 60 дней</div>
            <div className="space-y-2 text-small">
              {correlations.length === 0 && <div className="text-small text-text-dim">Нет привычек</div>}
              {correlations.map((c) => (
                <div key={c.title} className="flex items-center gap-3">
                  <div className="flex-1 truncate">{c.title}</div>
                  <CorrCell label="настр." value={c.rMood} />
                  <CorrCell label="задачи" value={c.rTasks} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* ЦЕЛИ */}
      {tab === 'goals' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Select value={goalId} onValueChange={setGoalId}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Цель" /></SelectTrigger>
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
            <div className="flex items-center gap-2 border border-border rounded-md px-3 py-1.5 text-caption">
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

          {goal && f ? (
            <>
              <Card>
                <div className="flex items-center justify-between mb-3">
                  <CardTitle className="!mb-0">Динамика и прогноз</CardTitle>
                  <div className="flex items-center gap-3 text-caption text-text-muted">
                    <Badge tone="info">прогноз</Badge>
                    <span>скорость: <b className="text-text">{fmtNum(f.velocity, 3)}</b> ед./день</span>
                    {f.etaDate && <span>ETA: <b className="text-text">{f.etaDate}</b></span>}
                    <span>точность: <b className="text-text">{Math.round(f.etaConfidence * 100)}%</b></span>
                  </div>
                </div>
                <ECharts height={340} option={mainChart(goal, recs, f, cc)} />
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <Card className="flex flex-col items-center justify-center">
                  <CardTitle>Прогресс цели</CardTitle>
                  <Ring
                    value={Math.round(((goal.current_value - goal.start_value) / (goal.target_value - goal.start_value || 1)) * 100)}
                    size={160}
                    stroke={12}
                    color="#6366f1"
                    glow={false}
                    trackColor="var(--border)"
                  >
                    <div className="text-center">
                      <div className="text-3xl font-semibold">{fmtNum(goal.current_value, 1)}</div>
                      <div className="text-caption text-text-muted">из {fmtNum(goal.target_value, 0)}{goal.unit ? ` ${goal.unit}` : ''}</div>
                    </div>
                  </Ring>
                </Card>

                <Card className="lg:col-span-2 flex flex-col justify-center">
                  <CardTitle>Диапазон достижения</CardTitle>
                  <div className="text-caption text-text-muted mb-3">95% доверительный интервал</div>
                  {f.etaDate ? (
                    <div className="space-y-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-text">{f.etaDate}</div>
                        <div className="text-caption text-text-muted">ожидаемая дата</div>
                      </div>
                      <div className="relative h-2 rounded-full bg-bg-soft overflow-hidden">
                        <div className="absolute inset-y-0 left-[15%] right-[15%] bg-accent/30" />
                        <div className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 bg-accent" />
                      </div>
                      <div className="flex justify-between text-caption text-text-muted">
                        <span>оптимистично</span>
                        <span>вероятно</span>
                        <span>пессимистично</span>
                      </div>
                      <div className="text-center text-small text-text-muted">
                        точность модели: <b className="text-text">{Math.round(f.etaConfidence * 100)}%</b>
                      </div>
                    </div>
                  ) : (
                    <div className="text-small text-text-dim text-center py-4">Недостаточно данных для прогноза. Записывайте прогресс цели.</div>
                  )}
                </Card>
              </div>
            </>
          ) : (
            <Card className="p-8 text-center text-small text-text-muted">Создай цель и записывай прогресс — здесь появится прогноз.</Card>
          )}
        </div>
      )}
    </PageContainer>
  );
};

const CorrCell: React.FC<{ label: string; value: number | null }> = ({ label, value }) => {
  if (value === null) return <span className="text-text-dim text-caption tabular-nums w-16 text-right">{label}: —</span>;
  const tone = value > 0.4 ? 'text-accent' : value < -0.4 ? 'text-danger' : 'text-text-muted';
  return (
    <span className={`text-caption tabular-nums w-16 text-right ${tone}`}>
      {label}: {value > 0 ? '+' : ''}{value.toFixed(2)}
    </span>
  );
};

function consistencyColor(ratio: number): string {
  const levels = ['#e0e7ff', '#a5b4fc', '#818cf8', '#6366f1', '#4338ca'];
  if (ratio === 0) return levels[0];
  if (ratio < 0.34) return levels[1];
  if (ratio < 0.67) return levels[2];
  if (ratio < 1) return levels[3];
  return levels[4];
}

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

function trendChart(series: number[], labels: string[], cc: ChartColors, color = '#6366f1') {
  return {
    grid: { left: 32, right: 14, top: 14, bottom: 26 },
    tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
    xAxis: {
      type: 'category', data: labels, boundaryGap: false,
      axisLabel: { color: cc.axis, fontSize: 10, hideOverlap: true },
      axisLine: { lineStyle: { color: cc.axisLine } },
    },
    yAxis: {
      type: 'value', max: 100, axisLabel: { color: cc.axis, fontSize: 10 },
      splitLine: { lineStyle: { color: cc.splitLine } },
      axisLine: { show: false }, axisTick: { show: false },
    },
    series: [{
      type: 'line', smooth: true, showSymbol: false, data: series,
      lineStyle: { color, width: 2.5 },
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: `${color}40` }, { offset: 1, color: `${color}00` }] } },
    }],
  };
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
        lineStyle: { color: '#6366f1', width: 2.5 },
        areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(99,102,241,0.3)' }, { offset: 1, color: 'rgba(99,102,241,0)' }] } },
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
