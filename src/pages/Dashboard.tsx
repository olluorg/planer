import { useMemo } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Ring } from '@/components/ui/ring';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Plus, ChevronRight, Sun, Moon } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate, pct, fmtNum } from '@/lib/utils';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ECharts } from '@/components/charts/ECharts';

const BLOCKS = [
  { key: 'morning', label: '06:00 – 12:00', icon: Sun },
  { key: 'day', label: '12:00 – 16:00', icon: Sun },
  { key: 'evening', label: '16:00 – 20:00', icon: Sun },
  { key: 'night', label: '20:00 – 23:00', icon: Moon },
] as const;

export const Dashboard: React.FC<{ date: Date }> = ({ date }) => {
  const { goals, tasks, habits, habitLogs, progress, toggleTask } = useStore();
  const today = isoDate(date);

  const dayTasks = tasks.filter((t) => t.date === today);
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });

  const weekStats = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)));
    const arr = days.map((d) => {
      const dt = tasks.filter((t) => t.date === d);
      return { date: d, total: dt.length, done: dt.filter((t) => t.status === 'done').length };
    });
    const total = arr.reduce((s, x) => s + x.total, 0);
    const done = arr.reduce((s, x) => s + x.done, 0);
    let bestI = 0, worstI = 0;
    arr.forEach((x, i) => {
      const r = x.total ? x.done / x.total : 0;
      const rb = arr[bestI].total ? arr[bestI].done / arr[bestI].total : 0;
      const rw = arr[worstI].total ? arr[worstI].done / arr[worstI].total : 1;
      if (r > rb) bestI = i;
      if (x.total > 0 && r < rw) worstI = i;
    });
    return { days, arr, total, done, bestI, worstI };
  }, [tasks, weekStart]);

  const overallGoalProgress = useMemo(() => {
    if (!goals.length) return 0;
    const sum = goals.reduce((s, g) => {
      const denom = g.target_value - g.start_value || 1;
      return s + Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
    }, 0);
    return Math.round((sum / goals.length) * 100);
  }, [goals]);

  const weekDoneRatio = weekStats.total ? Math.round((weekStats.done / weekStats.total) * 100) : 0;

  const habitWeek = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)));
    return habits.map((h) => {
      const marks = days.map((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d));
      return { habit: h, marks, done: marks.filter(Boolean).length };
    });
  }, [habits, habitLogs, weekStart]);

  // Goals plan stripe (long-term)
  const planGoals = goals.slice(0, 5);

  // Stats (steps/calories etc — derive from progress entries for fitness goal demo, fallback static)
  const fitnessStats = [
    { label: 'Шаги', cur: 8432, max: 10000, color: '#22c55e' },
    { label: 'Калории', cur: 1870, max: 2300, color: '#eab308' },
    { label: 'Тренировки', cur: 4, max: 5, color: '#22c55e' },
    { label: 'Вода', cur: 1.6, max: 2, unit: ' л', color: '#3b82f6' },
  ];

  const weekChartOpt = {
    grid: { left: 30, right: 10, top: 10, bottom: 24 },
    xAxis: {
      type: 'category',
      data: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
      axisLine: { lineStyle: { color: '#262626' } },
      axisLabel: { color: '#a3a3a3', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      max: 100,
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: '#1f1f1f' } },
      axisLabel: { color: '#a3a3a3', fontSize: 11, formatter: '{value}%' },
    },
    series: [
      {
        type: 'bar',
        barWidth: 22,
        data: weekStats.arr.map((x, i) => {
          const v = x.total ? Math.round((x.done / x.total) * 100) : 0;
          let color = '#262626';
          if (i === weekStats.bestI && x.total) color = '#22c55e';
          else if (i === weekStats.worstI && x.total) color = '#ef4444';
          else if (v >= 60) color = '#eab308';
          return { value: v, itemStyle: { color, borderRadius: [4, 4, 0, 0] } };
        }),
      },
    ],
  };

  return (
    <div className="p-4 grid grid-cols-12 gap-4">
      {/* ROW 1: Goals/Stats/Chart + Progress ring */}
      <Card className="col-span-9 grid grid-cols-12 gap-6">
        <div className="col-span-4">
          <CardTitle>Цели на неделю</CardTitle>
          <ol className="space-y-2.5">
            {goals.slice(0, 5).map((g, i) => {
              const denom = g.target_value - g.start_value || 1;
              const r = Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
              const done = r >= 1;
              return (
                <li key={g.id} className="flex items-center gap-3 text-sm">
                  <span className="text-text-dim w-3">{i + 1}</span>
                  <span className="flex-1 truncate">{g.title}</span>
                  <Checkbox checked={done} disabled />
                </li>
              );
            })}
          </ol>
        </div>

        <div className="col-span-3 flex flex-col items-center justify-center">
          <Ring value={weekDoneRatio} size={140} stroke={10} color="#fafafa" trackColor="#262626">
            <div className="text-center">
              <div className="text-2xl font-semibold">{weekDoneRatio}%</div>
              <div className="text-[11px] text-text-muted">Неделя</div>
            </div>
          </Ring>
        </div>

        <div className="col-span-2 flex flex-col justify-center text-sm space-y-2">
          <Row label="Всего задач" value={String(weekStats.total)} />
          <Row label="Выполнено" value={String(weekStats.done)} />
          <Row label="Осталось" value={String(weekStats.total - weekStats.done)} />
          <Row label="Лучший день" value={dayName(weekStats.bestI)} valueClass="text-accent" />
          <Row label="Худший день" value={dayName(weekStats.worstI)} valueClass="text-danger" />
        </div>

        <div className="col-span-3">
          <ECharts option={weekChartOpt} height={170} />
        </div>
      </Card>

      <Card className="col-span-3">
        <CardTitle>Прогресс целей</CardTitle>
        <div className="flex flex-col items-center">
          <Ring value={overallGoalProgress} size={140} stroke={10}>
            <div className="text-center">
              <div className="text-2xl font-semibold">{overallGoalProgress}%</div>
              <div className="text-[11px] text-text-muted">Общий прогресс</div>
            </div>
          </Ring>
        </div>
        <Button variant="ghost" className="w-full justify-between mt-4 text-text-muted">
          Все цели <ChevronRight className="h-4 w-4" />
        </Button>
      </Card>

      {/* ROW 2: time blocks */}
      {BLOCKS.map((b) => {
        const blockTasks = dayTasks.filter((t) => t.time_block === b.key);
        const done = blockTasks.filter((t) => t.status === 'done').length;
        const ratio = blockTasks.length ? Math.round((done / blockTasks.length) * 100) : 0;
        return (
          <Card key={b.key} className="col-span-2 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm">{b.label}</div>
              <b.icon className="h-4 w-4 text-text-muted" />
            </div>
            <div className="space-y-2 flex-1">
              {blockTasks.length === 0 && <div className="text-xs text-text-dim">Нет задач</div>}
              {blockTasks.map((t) => (
                <label key={t.id} className="flex items-center gap-2.5 text-[13px] cursor-pointer">
                  <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
                  <span className={t.status === 'done' ? 'text-text' : 'text-text-muted'}>{t.title}</span>
                </label>
              ))}
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t border-border-soft">
              <div>
                <div className="text-[11px] text-text-muted">Выполнено</div>
                <div className="text-sm">{done}/{blockTasks.length}</div>
              </div>
              <Ring value={ratio} size={48} stroke={5} color="#fafafa">
                <div className="text-[11px]">{ratio}%</div>
              </Ring>
            </div>
          </Card>
        );
      })}

      <Card className="col-span-2">
        <div className="text-sm mb-3">Заметки на день</div>
        <textarea
          className="w-full h-24 bg-transparent text-xs text-text-muted resize-none outline-none"
          defaultValue="Отличный день. Удалось сосредоточиться и выполнить главное."
        />
        <Button variant="ghost" size="sm" className="w-full justify-start text-text-muted mt-2">
          <Plus className="h-3.5 w-3.5" /> Новая заметка
        </Button>
      </Card>

      <Card className="col-span-2">
        <CardTitle>Статистика</CardTitle>
        <div className="space-y-3">
          {fitnessStats.map((s) => (
            <div key={s.label}>
              <div className="flex justify-between text-sm">
                <span className="text-text-muted">{s.label}</span>
                <span className="tabular-nums">{fmtNum(s.cur, 1)} / {fmtNum(s.max, 0)}{s.unit ?? ''}</span>
              </div>
              <Progress value={(s.cur / s.max) * 100} className="mt-1.5" barClassName="" />
            </div>
          ))}
        </div>
        <Button variant="ghost" className="w-full justify-between mt-4 text-text-muted">
          Вся статистика <ChevronRight className="h-4 w-4" />
        </Button>
      </Card>

      {/* ROW 3: long term goals */}
      <Card className="col-span-9">
        <CardTitle>План на будущее</CardTitle>
        <div className="grid grid-cols-5 gap-3">
          {planGoals.map((g) => {
            const denom = g.target_value - g.start_value || 1;
            const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
            const monthLabel = g.deadline ? format(new Date(g.deadline), 'LLLL yyyy', { locale: ru }) : '—';
            return (
              <div key={g.id} className="rounded-lg border border-border bg-bg-soft p-3 hover:border-accent/40 transition-colors">
                <div className="text-[11px] text-text-muted">{monthLabel}</div>
                <div className="text-sm font-medium mt-1 truncate">{g.title}</div>
                <div className="mt-3 text-2xl font-semibold tabular-nums">
                  {fmtNum(g.current_value, 1)}{g.unit ? ` ${g.unit}` : ''}
                </div>
                <div className="text-[11px] text-text-muted mt-0.5">
                  цель {fmtNum(g.target_value, 0)}{g.unit ? ` ${g.unit}` : ''}
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <Progress value={r} className="flex-1" />
                  <span className="text-[11px] text-text-muted tabular-nums">{r}%</span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="col-span-3">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="mb-0">Привычки</CardTitle>
          <Button variant="ghost" size="sm" className="text-text-muted">Изменить</Button>
        </div>
        <div className="space-y-3">
          {habitWeek.map(({ habit, marks, done }) => (
            <div key={habit.id} className="flex items-center gap-3">
              <div className="text-[13px] flex-1 truncate">{habit.title}</div>
              <div className="flex gap-1">
                {marks.map((m, i) => (
                  <div
                    key={i}
                    className="h-2 w-2 rounded-full"
                    style={{ background: m ? habit.color ?? '#22c55e' : '#262626' }}
                  />
                ))}
              </div>
              <div className="text-[11px] text-text-muted tabular-nums w-8 text-right">{done}/7</div>
            </div>
          ))}
        </div>
        <Button variant="ghost" className="w-full justify-between mt-4 text-text-muted">
          Все привычки <ChevronRight className="h-4 w-4" />
        </Button>
      </Card>

      {/* ROW 4: focus / quick add / reflection / reminders */}
      <Card className="col-span-3">
        <CardTitle>Фокус дня</CardTitle>
        <p className="text-sm text-text-muted leading-relaxed">
          Сделай сегодня немного больше, чем вчера, и это изменит твоё завтра.
        </p>
      </Card>

      <Card className="col-span-3">
        <CardTitle>Быстрое добавление</CardTitle>
        <div className="flex justify-around">
          {[
            { l: 'Задача', i: '✓' },
            { l: 'Привычка', i: '↻' },
            { l: 'Тренировка', i: '✦' },
            { l: 'Заметка', i: '✎' },
            { l: 'Показатель', i: '◐' },
          ].map((q) => (
            <button key={q.l} className="flex flex-col items-center gap-1.5 text-text-muted hover:text-text">
              <div className="h-10 w-10 rounded-md border border-border bg-bg-soft flex items-center justify-center">
                {q.i}
              </div>
              <span className="text-[11px]">{q.l}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card className="col-span-3">
        <CardTitle>Рефлексия</CardTitle>
        <div className="text-sm mb-3">Как прошёл твой день?</div>
        <div className="flex justify-between">
          {['😞', '😕', '😐', '🙂', '😊'].map((e, i) => (
            <button key={i} className="h-10 w-10 rounded-full bg-bg-soft hover:bg-bg-hover text-xl">{e}</button>
          ))}
        </div>
      </Card>

      <Card className="col-span-3">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="mb-0">Напоминания</CardTitle>
          <Button variant="ghost" size="icon"><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-border" /> Тренировка в 18:00</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full border border-border" /> Медитация в 21:30</div>
        </div>
      </Card>
    </div>
  );
};

const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
  <div className="flex justify-between">
    <span className="text-text-muted">{label}</span>
    <span className={valueClass}>{value}</span>
  </div>
);

const dayName = (i: number) => ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][i];
