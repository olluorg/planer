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
import { useTheme } from '@/lib/theme';
import { getChartColors } from '@/lib/chart-theme';

const MOODS = ['😞', '😕', '😐', '🙂', '😊'];

export const ReflectionPage: React.FC<{ date: Date }> = ({ date }) => {
  const { reflections, tasks, upsertReflection } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const today = isoDate(date);
  const cur = reflections.find((r) => r.date === today);
  const [mood, setMood] = useState<number | null>(cur?.mood ?? null);
  const [done, setDone] = useState(cur?.done ?? '');
  const [notDone, setNotDone] = useState(cur?.not_done ?? '');
  const [reason, setReason] = useState(cur?.reason ?? '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setMood(cur?.mood ?? null);
    setDone(cur?.done ?? '');
    setNotDone(cur?.not_done ?? '');
    setReason(cur?.reason ?? '');
    setSaved(false);
  }, [today]);

  const save = async () => {
    upsertReflection({ date: today, mood, done, not_done: notDone, reason });
    await persist();
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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

  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
      <Card className="lg:col-span-7">
        <CardTitle>Рефлексия · {format(date, 'd MMMM yyyy', { locale: ru })}</CardTitle>

        <div className="text-sm mb-2 text-text-muted">Как прошёл день?</div>
        <div className="flex gap-2 mb-5">
          {MOODS.map((e, i) => (
            <button
              key={i}
              onClick={() => setMood(i)}
              className={`h-12 w-12 rounded-full text-xl transition-all ${mood === i ? 'bg-accent text-black ring-2 ring-accent' : 'bg-bg-soft hover:bg-bg-hover'}`}
            >{e}</button>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-sm text-text-muted mb-1">Что выполнено</div>
            <Textarea value={done} onChange={(e) => setDone(e.target.value)} placeholder="3 главные победы дня..." />
          </div>
          <div>
            <div className="text-sm text-text-muted mb-1">Что не выполнено</div>
            <Textarea value={notDone} onChange={(e) => setNotDone(e.target.value)} placeholder="Что осталось..." />
          </div>
          <div>
            <div className="text-sm text-text-muted mb-1">Причина</div>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Почему так получилось..." />
          </div>
        </div>

        <Button onClick={save} className="mt-4">{saved ? '✓ Сохранено' : 'Сохранить'}</Button>
      </Card>

      <div className="lg:col-span-5 space-y-4">
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
                data: week.map((w) => {
                  const v = w.total ? Math.round((w.done / w.total) * 100) : 0;
                  const hue = Math.round((Math.max(0, Math.min(100, v)) / 100) * 130);
                  return { value: v, itemStyle: { color: `hsl(${hue} 70% 50%)` } };
                }),
              },
              { name: 'Настроение', type: 'line', yAxisIndex: 1, smooth: true, data: week.map((w) => w.mood), lineStyle: { color: '#eab308' }, itemStyle: { color: '#eab308' } },
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
