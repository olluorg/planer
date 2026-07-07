import { useEffect, useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useStore } from '@/lib/store';
import { persist } from '@/lib/db';
import { isoDate } from '@/lib/utils';
import { addDays, startOfWeek, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ECharts } from '@/components/charts/ECharts';
import { Sparkline } from '@/components/ui/sparkline';
import { useTheme } from '@/lib/theme';
import { getChartColors } from '@/lib/chart-theme';

const MOODS = ['😞', '😕', '😐', '🙂', '😊'];

export const ReflectionPage: React.FC<{ date: Date }> = ({ date }) => {
  const { reflections, tasks, habits, habitLogs, timeEntries, healthLogs, upsertReflection } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const today = isoDate(date);
  const cur = reflections.find((r) => r.date === today);
  const [mood, setMood] = useState<number | null>(cur?.mood ?? null);
  const [done, setDone] = useState(cur?.done ?? '');
  const [notDone, setNotDone] = useState(cur?.not_done ?? '');
  const [reason, setReason] = useState(cur?.reason ?? '');
  const [gratitude, setGratitude] = useState(cur?.note ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMood(cur?.mood ?? null);
    setDone(cur?.done ?? '');
    setNotDone(cur?.not_done ?? '');
    setReason(cur?.reason ?? '');
    setGratitude(cur?.note ?? '');
    setSaved(false);
  }, [today]);

  const save = async () => {
    upsertReflection({ date: today, mood, done, not_done: notDone, reason, note: gratitude });
    await persist();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Итог дня — факты, на которые опирается рефлексия
  const dayFacts = useMemo(() => {
    const dt = tasks.filter((t) => t.date === today && !t.parent_id);
    const doneTasks = dt.filter((t) => t.status === 'done');
    const habitsDone = habits.filter((h) => habitLogs.some((l) => l.habit_id === h.id && l.date === today)).length;
    const focusMin = Math.round(timeEntries
      .filter((e) => e.type === 'pomodoro' && isoDate(new Date(e.started_at)) === today)
      .reduce((s, e) => s + e.duration, 0) / 60);
    const hl = healthLogs.filter((l) => l.date === today);
    return { total: dt.length, done: doneTasks.length, top: doneTasks.slice(0, 3), habitsDone, habitsTotal: habits.length, focusMin, healthLogged: hl.length };
  }, [tasks, habits, habitLogs, timeEntries, healthLogs, today]);

  const week = useMemo(() => {
    const start = startOfWeek(date, { weekStartsOn: 1 });
    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(start, i)));
    return days.map((d) => {
      const dt = tasks.filter((t) => t.date === d);
      const r = reflections.find((x) => x.date === d);
      return {
        date: d,
        total: dt.length,
        done: dt.filter((t) => t.status === 'done').length,
        mood: r?.mood ?? null,
      };
    });
  }, [date, tasks, reflections]);

  const moodAvg = week.filter((d) => d.mood !== null).reduce((s, d, _, a) => s + (d.mood as number) / (a.length || 1), 0);

  const streak = useMemo(() => {
    let s = 0;
    for (let i = 0; ; i++) {
      const d = isoDate(addDays(date, -i));
      const r = reflections.find((x) => x.date === d);
      if (r && r.mood !== null) s++; else break;
    }
    return s;
  }, [date, reflections]);

  const moodSeries = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => {
      const d = isoDate(addDays(date, -13 + i));
      const r = reflections.find((x) => x.date === d);
      return r?.mood != null ? r.mood : 0;
    }), [date, reflections]);

  return (
    <div className="page py-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-7">
        <CardTitle>Рефлексия · {format(date, 'd MMMM yyyy', { locale: ru })}</CardTitle>

        {/* Итог дня: факты перед глазами, чтобы не рефлексировать вслепую */}
        <div className="rounded-xl bg-bg-soft p-3.5 mb-5">
          <div className="section-label !mb-2">Итог дня</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-small">
            <span className="text-text-muted">Задачи: <b className="text-text tabular-nums">{dayFacts.done}/{dayFacts.total}</b></span>
            <span className="text-text-muted">Привычки: <b className="text-text tabular-nums">{dayFacts.habitsDone}/{dayFacts.habitsTotal}</b></span>
            <span className="text-text-muted">Фокус: <b className="text-text tabular-nums">{dayFacts.focusMin ? `${dayFacts.focusMin} мин` : '—'}</b></span>
            <span className="text-text-muted">Здоровье: <b className="text-text tabular-nums">{dayFacts.healthLogged ? `${dayFacts.healthLogged} метрик` : '—'}</b></span>
          </div>
          {dayFacts.top.length > 0 && (
            <div className="mt-2 text-caption text-text-muted">
              Сделано: {dayFacts.top.map((t) => t.title).join(' · ')}{dayFacts.done > 3 ? ` · ещё ${dayFacts.done - 3}` : ''}
            </div>
          )}
        </div>

        <div className="text-sm mb-2 text-text-muted">Как прошёл день?</div>
        <div className="flex gap-2 mb-5">
          {MOODS.map((e, i) => (
            <button
              key={i}
              onClick={() => setMood(i)}
              className={`h-12 w-12 rounded-full text-xl transition-all ${mood === i ? 'bg-accent text-white ring-2 ring-accent' : 'bg-bg-soft hover:bg-bg-hover'}`}
            >{e}</button>
          ))}
        </div>

        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-1.5">
              <span className="h-5 w-5 rounded-md bg-success/15 text-success flex items-center justify-center text-xs">✓</span>
              Что прошло хорошо
            </div>
            <Textarea value={done} onChange={(e) => setDone(e.target.value)} placeholder="3 главные победы дня..." />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-1.5">
              <span className="h-5 w-5 rounded-md bg-warning/15 text-warning flex items-center justify-center text-xs">↑</span>
              Что можно улучшить
            </div>
            <Textarea value={notDone} onChange={(e) => setNotDone(e.target.value)} placeholder="Что осталось / над чем поработать..." />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-1.5">
              <span className="h-5 w-5 rounded-md bg-info/15 text-info flex items-center justify-center text-xs">→</span>
              Планы на завтра
            </div>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Завтра я..." />
          </div>
          <div>
            <div className="flex items-center gap-2 text-sm font-medium mb-1.5">
              <span className="h-5 w-5 rounded-md bg-accent/15 text-accent flex items-center justify-center text-xs">♥</span>
              Благодарность
            </div>
            <Textarea value={gratitude} onChange={(e) => setGratitude(e.target.value)} placeholder="За что я благодарен сегодня..." />
          </div>
        </div>

        <Button onClick={save} className="mt-4">{saved ? '✓ Сохранено' : 'Сохранить'}</Button>
      </Card>

      <div className="lg:col-span-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="flex flex-col items-center justify-center text-center">
            <CardTitle>Настроение</CardTitle>
            <div className="text-4xl leading-none">{mood != null ? MOODS[mood] : '—'}</div>
            <div className="text-small text-text-muted mt-2">{mood != null ? `${mood + 1}/5` : 'не отмечено'}</div>
          </Card>
          <Card>
            <CardTitle>Серия рефлексий</CardTitle>
            <div className="text-h1 tabular-nums leading-none">{streak}</div>
            <div className="text-caption text-text-muted mt-1 mb-2">дней подряд</div>
            <Sparkline data={moodSeries} color="#6366f1" width={130} height={40} />
          </Card>
        </div>

        <Card>
          <CardTitle>Недельный обзор</CardTitle>
          <ECharts height={200} option={{
            grid: { left: 30, right: 10, top: 20, bottom: 30 },
            tooltip: { trigger: 'axis', backgroundColor: cc.tooltipBg, borderColor: cc.tooltipBorder, textStyle: { color: cc.tooltipText } },
            xAxis: { type: 'category', data: week.map((w) => format(new Date(w.date), 'EEE', { locale: ru })), axisLabel: { color: cc.axis }, axisLine: { lineStyle: { color: cc.axisLine } } },
            yAxis: [
              { type: 'value', max: 100, axisLabel: { color: cc.axis, formatter: '{value}%' }, splitLine: { lineStyle: { color: cc.splitLine } }, axisLine: { show: false }, axisTick: { show: false } },
              { type: 'value', min: 0, max: 4, axisLabel: { color: cc.axis }, splitLine: { show: false }, axisLine: { show: false }, axisTick: { show: false } },
            ],
            series: [
              { name: 'Выполнено', type: 'bar', barWidth: 16,
                data: week.map((w) => ({
                  value: w.total ? Math.round((w.done / w.total) * 100) : 0,
                  itemStyle: { color: '#6366f1', borderRadius: [4, 4, 0, 0] },
                })),
              },
              { name: 'Настроение', type: 'line', yAxisIndex: 1, smooth: true, data: week.map((w) => w.mood), lineStyle: { color: '#f59e0b' }, itemStyle: { color: '#f59e0b' } },
            ],
          }} />
        </Card>

        <Card>
          <CardTitle>Выводы недели</CardTitle>
          <ul className="text-sm space-y-2">
            <li className="flex items-start gap-2">
              <Badge tone="accent">+</Badge>
              <span>Среднее настроение: <b>{moodAvg ? moodAvg.toFixed(1) : '—'}</b> / 4</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge tone="info">i</Badge>
              <span>Выполнено: <b>{week.reduce((s, d) => s + d.done, 0)}</b> из <b>{week.reduce((s, d) => s + d.total, 0)}</b> задач</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge tone="warn">!</Badge>
              <span>Дни без рефлексии: <b>{week.filter((d) => d.mood === null).length}</b></span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
};
