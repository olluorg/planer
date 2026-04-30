import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Responsive, WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const RGL = WidthProvider(Responsive);
import { CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Ring } from '@/components/ui/ring';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Plus, ChevronRight, Sun, Moon, Lock, Unlock, RotateCcw, Trash2,
  CheckSquare, Repeat, NotebookPen, Dumbbell, Timer, Target,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate, fmtNum, colorByPct } from '@/lib/utils';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ECharts } from '@/components/charts/ECharts';
import { useTheme } from '@/lib/theme';
import { getChartColors } from '@/lib/chart-theme';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { QuickAddDialog } from '@/components/QuickAddDialog';
import { PRESETS } from '@/lib/dashboardPresets';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

const BLOCKS = [
  { key: 'morning', label: '06:00 – 12:00', icon: Sun },
  { key: 'day', label: '12:00 – 16:00', icon: Sun },
  { key: 'evening', label: '16:00 – 20:00', icon: Sun },
  { key: 'night', label: '20:00 – 23:00', icon: Moon },
] as const;

const DEFAULT_LAYOUT: Layout[] = [
  { i: 'goals-week',    x: 0,  y: 0,  w: 12, h: 6 },
  { i: 'block-morning', x: 0,  y: 6,  w: 2,  h: 7 },
  { i: 'block-day',     x: 2,  y: 6,  w: 2,  h: 7 },
  { i: 'block-evening', x: 4,  y: 6,  w: 2,  h: 7 },
  { i: 'block-night',   x: 6,  y: 6,  w: 2,  h: 7 },
  { i: 'notes',         x: 8,  y: 6,  w: 4,  h: 7 },
  { i: 'plan-future',   x: 0,  y: 13, w: 12, h: 9 },
  { i: 'focus',         x: 0,  y: 22, w: 4,  h: 4 },
  { i: 'quick-add',     x: 4,  y: 22, w: 4,  h: 4 },
  { i: 'reflection',    x: 8,  y: 22, w: 4,  h: 4 },
  { i: 'kpi-grid',      x: 0,  y: 26, w: 12, h: 5 },
];

// Mobile layout: single-column (4 cols), stacked vertically
const MOBILE_LAYOUT: Layout[] = [
  { i: 'goals-week',    x: 0, y: 0,  w: 4, h: 7  },
  { i: 'block-morning', x: 0, y: 7,  w: 4, h: 7  },
  { i: 'block-day',     x: 0, y: 14, w: 4, h: 7  },
  { i: 'block-evening', x: 0, y: 21, w: 4, h: 7  },
  { i: 'block-night',   x: 0, y: 28, w: 4, h: 7  },
  { i: 'plan-future',   x: 0, y: 35, w: 4, h: 8  },
  { i: 'focus',         x: 0, y: 43, w: 4, h: 4  },
  { i: 'quick-add',     x: 0, y: 47, w: 4, h: 4  },
  { i: 'reflection',    x: 0, y: 51, w: 4, h: 4  },
  { i: 'notes',         x: 0, y: 55, w: 4, h: 5  },
  { i: 'kpi-grid',      x: 0, y: 60, w: 4, h: 5  },
];

const ROW_HEIGHT = 48;

export const Dashboard: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { goals, tasks, habits, habitLogs, toggleTask, addProgress, upsertReflection } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const today = isoDate(date);

  const [layout, setLayout] = useLocalStorage<Layout[]>('dashboard.layout.v5', DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [hidden, setHidden] = useLocalStorage<string[]>('dashboard.hidden.v3', []);
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('dashboard.notes', {});
  const [reminders, setReminders] = useLocalStorage<{ id: string; text: string; done: boolean }[]>(
    'dashboard.reminders',
    [
      { id: 'r1', text: 'Тренировка в 18:00', done: false },
      { id: 'r2', text: 'Медитация в 21:30', done: false },
    ],
  );
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | null>(null);
  const [kpiGoals, setKpiGoals] = useLocalStorage<string[]>('dashboard.kpiGoals', []);

  const applyPreset = (id: string) => {
    const p = PRESETS.find((x) => x.id === id);
    if (!p) return;
    setLayout(p.layout);
    setHidden(p.hidden);
  };

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
    return { arr, total, done, bestI, worstI };
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

  const velocityHint = useMemo(() => {
    const prevStart = addDays(weekStart, -7);
    const prev = Array.from({ length: 7 }, (_, i) => isoDate(addDays(prevStart, i)));
    const prevTotal = tasks.filter((t) => prev.includes(t.date)).length;
    const prevDone = tasks.filter((t) => prev.includes(t.date) && t.status === 'done').length;
    const prevR = prevTotal ? prevDone / prevTotal : 0;
    const curR = weekStats.total ? weekStats.done / weekStats.total : 0;
    if (prevTotal === 0) return null;
    const delta = Math.round((curR - prevR) * 100);
    return delta;
  }, [tasks, weekStart, weekStats]);

  const habitWeek = useMemo(() => {
    const days = Array.from({ length: 7 }, (_, i) => isoDate(addDays(weekStart, i)));
    return habits.map((h) => {
      const marks = days.map((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d));
      return { habit: h, marks, done: marks.filter(Boolean).length };
    });
  }, [habits, habitLogs, weekStart]);

  const planGoals = goals.slice(0, 5);

  const fitnessStats = [
    { label: 'Шаги', cur: 8432, max: 10000 },
    { label: 'Калории', cur: 1870, max: 2300 },
    { label: 'Тренировки', cur: 4, max: 5 },
    { label: 'Вода', cur: 1.6, max: 2, unit: ' л' },
  ];

  const weekChartOpt = {
    grid: { left: 30, right: 10, top: 10, bottom: 24 },
    xAxis: {
      type: 'category', data: ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'],
      axisLine: { lineStyle: { color: cc.axisLine } },
      axisLabel: { color: cc.axis, fontSize: 11 },
    },
    yAxis: {
      type: 'value', max: 100,
      axisLine: { show: false }, axisTick: { show: false },
      splitLine: { lineStyle: { color: cc.splitLine } },
      axisLabel: { color: cc.axis, fontSize: 11, formatter: '{value}%' },
    },
    series: [{
      type: 'bar', barWidth: 22,
      data: weekStats.arr.map((x) => {
        const v = x.total ? Math.round((x.done / x.total) * 100) : 0;
        const color = x.total === 0 ? cc.emptyBar : colorByPct(v);
        return { value: v, itemStyle: { color } };
      }),
    }],
  };

  const dayName = (i: number) => ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'][i];

  const Row: React.FC<{ label: string; value: string; valueClass?: string }> = ({ label, value, valueClass }) => (
    <div className="flex justify-between"><span className="text-text-muted">{label}</span><span className={valueClass}>{value}</span></div>
  );

  const toggleGoalDone = (id: string) => {
    const g = goals.find((x) => x.id === id);
    if (!g) return;
    const denom = g.target_value - g.start_value || 1;
    const r = (g.current_value - g.start_value) / denom;
    const nextValue = r >= 1 ? g.start_value : g.target_value;
    addProgress({ goal_id: id, date: today, value: nextValue, note: null });
  };

  const addReminder = () => {
    const text = window.prompt('Текст напоминания:');
    if (!text?.trim()) return;
    setReminders((r) => [...r, { id: Math.random().toString(36).slice(2, 10), text: text.trim(), done: false }]);
  };

  const setMood = (m: number) => {
    upsertReflection({ date: today, mood: m });
    nav('/reflection');
  };

  const resetLayout = () => { setLayout(DEFAULT_LAYOUT); setHidden([]); };
  const hideWidget = (id: string) => setHidden((h) => [...new Set([...h, id])]);
  const showAll = () => setHidden([]);

  const visibleLayout = layout.filter((l) => !hidden.includes(l.i));

  // Each widget is a function returning JSX. The grid item wraps it with the card frame.
  const widgets: Record<string, () => React.ReactNode> = {
    'goals-week': () => (
      <WidgetCard title="Цели на неделю" editing={editing} onHide={() => hideWidget('goals-week')} onClick={() => !editing && nav('/goals')}>
        {/* Mobile: стек, Desktop: 4-колоночная сетка */}
        <div className="flex flex-col gap-3 sm:grid sm:grid-cols-12 sm:gap-4 h-full sm:items-center">
          {/* Ring — на мобильных сверху */}
          <div className="sm:col-span-3 flex justify-center items-center order-first sm:order-none">
            <Ring value={weekDoneRatio} size={110} stroke={10} color={colorByPct(weekDoneRatio)}>
              <div className="text-center">
                <div className="text-xl font-semibold">{weekDoneRatio}%</div>
                <div className="text-[10px] text-text-muted">Неделя</div>
              </div>
            </Ring>
          </div>
          {/* Goals list */}
          <div className="sm:col-span-4 flex flex-col justify-center">
            <ol className="space-y-2">
              {goals.slice(0, 5).map((g, i) => {
                const denom = g.target_value - g.start_value || 1;
                const r = Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
                const done = r >= 1;
                return (
                  <li key={g.id} className="flex items-center gap-2 text-sm">
                    <span className="text-text-dim w-3 shrink-0">{i + 1}</span>
                    <span className="flex-1 truncate">{g.title}</span>
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={done} onCheckedChange={() => toggleGoalDone(g.id)} />
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
          {/* Stats — hidden on mobile */}
          <div className="hidden sm:flex sm:col-span-2 flex-col justify-center text-sm space-y-1.5">
            <Row label="Всего" value={String(weekStats.total)} />
            <Row label="Готово" value={String(weekStats.done)} />
            <Row label="Осталось" value={String(weekStats.total - weekStats.done)} />
            <Row label="Лучший" value={dayName(weekStats.bestI)} valueClass="text-accent" />
            <Row label="Худший" value={dayName(weekStats.worstI)} valueClass="text-danger" />
          </div>
          {/* Bar chart — hidden on mobile */}
          <div className="hidden sm:flex sm:col-span-3 min-w-0 items-center">
            <ECharts option={weekChartOpt} height={140} />
          </div>
        </div>
      </WidgetCard>
    ),

    'progress-ring': () => (
      <WidgetCard title="Прогресс целей" editing={editing} onHide={() => hideWidget('progress-ring')}>
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center">
            <Ring value={overallGoalProgress} size={140} stroke={10} color={colorByPct(overallGoalProgress)}>
              <div className="text-center">
                <div className="text-2xl font-semibold">{overallGoalProgress}%</div>
                <div className="text-[11px] text-text-muted">Общий</div>
              </div>
            </Ring>
          </div>
          {velocityHint !== null && (
            <div className="text-center text-xs mb-2">
              {velocityHint > 0 && <span className="text-accent">↗ ускорение {velocityHint > 0 ? '+' : ''}{velocityHint}% к прошлой неделе</span>}
              {velocityHint === 0 && <span className="text-text-muted">→ темп без изменений</span>}
              {velocityHint < 0 && <span className="text-danger">↘ отстаёшь {velocityHint}% от прошлой недели</span>}
            </div>
          )}
          <Button variant="ghost" className="w-full justify-between text-text-muted" onClick={() => nav('/goals')}>
            Все цели <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </WidgetCard>
    ),

    ...Object.fromEntries(BLOCKS.map((b) => [
      `block-${b.key}`,
      () => {
        const blockTasks = dayTasks.filter((t) => t.time_block === b.key);
        const done = blockTasks.filter((t) => t.status === 'done').length;
        const ratio = blockTasks.length ? Math.round((done / blockTasks.length) * 100) : 0;
        return (
          <WidgetCard editing={editing} onHide={() => hideWidget(`block-${b.key}`)}>
            <div className="flex flex-col h-full">
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm">{b.label}</div>
                <b.icon className="h-4 w-4 text-text-muted" />
              </div>
              <div className="space-y-1 flex-1 overflow-auto -mx-2">
                {blockTasks.length === 0 && <div className="text-xs text-text-dim px-2">Нет задач</div>}
                {[...blockTasks].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')).map((t) => (
                  <label
                    key={t.id}
                    className={`flex items-center gap-2.5 px-2 py-2.5 min-h-[44px] cursor-pointer transition-colors hover:bg-bg-hover rounded-sm ${t.status === 'done' ? 'animate-pulse-ok' : ''}`}
                  >
                    <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
                    {t.start_time && <span className="text-text-dim text-[11px] tabular-nums w-10">{t.start_time}</span>}
                    <span className={`text-sm font-medium transition-all ${t.status === 'done' ? 'text-text-muted line-through' : ''}`}>{t.title}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-soft">
                <div>
                  <div className="text-[11px] text-text-muted">Выполнено</div>
                  <div className="text-sm">{done}/{blockTasks.length}</div>
                </div>
                <Ring value={ratio} size={42} stroke={4} color={blockTasks.length ? colorByPct(ratio) : 'var(--text)'}>
                  <div className="text-[10px]">{ratio}%</div>
                </Ring>
              </div>
            </div>
          </WidgetCard>
        );
      },
    ])) as Record<string, () => React.ReactNode>,

    'notes': () => (
      <WidgetCard editing={editing} onHide={() => hideWidget('notes')}>
        <div className="flex flex-col h-full">
          <div className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-3">Заметка на день</div>
          <div className="text-text-muted text-lg mb-2 leading-none">"</div>
          <textarea
            className="flex-1 w-full bg-transparent text-sm text-text resize-none outline-none border-0 leading-relaxed"
            value={notes[today] ?? ''}
            onChange={(e) => setNotes({ ...notes, [today]: e.target.value })}
            placeholder="Запиши мысли дня..."
          />
          <button
            className="mt-2 flex items-center gap-1.5 text-xs text-text-muted hover:text-accent transition-colors"
            onClick={() => setNotes({ ...notes, [today]: (notes[today] ?? '') })}
          >
            <Plus className="h-3.5 w-3.5" /> Новая заметка
          </button>
        </div>
      </WidgetCard>
    ),

    'stats': () => (
      <WidgetCard title="Статистика" editing={editing} onHide={() => hideWidget('stats')}>
        <div className="flex flex-col h-full">
          <div className="space-y-3 flex-1">
            {fitnessStats.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">{s.label}</span>
                  <span className="tabular-nums">{fmtNum(s.cur, 1)} / {fmtNum(s.max, 0)}{s.unit ?? ''}</span>
                </div>
                <Progress value={(s.cur / s.max) * 100} className="mt-1.5" barColor={colorByPct((s.cur / s.max) * 100)} />
              </div>
            ))}
          </div>
          <Button variant="ghost" className="w-full justify-between mt-3 text-text-muted" onClick={() => nav('/analytics')}>
            Вся статистика <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </WidgetCard>
    ),

    'plan-future': () => (
      <WidgetCard title="План на будущее" editing={editing} onHide={() => hideWidget('plan-future')}>
        <div className="flex gap-3 overflow-x-auto pb-2 h-full" style={{ scrollbarWidth: 'thin' }}>
          {planGoals.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-text-dim">
              Нет целей. Добавь первую цель.
            </div>
          )}
          {planGoals.map((g) => {
            const denom = g.target_value - g.start_value || 1;
            const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
            const monthLabel = g.deadline ? format(new Date(g.deadline), 'LLLL yyyy', { locale: ru }) : '—';
            return (
              <button
                key={g.id}
                onClick={() => !editing && nav('/goals')}
                className="group text-left border border-border hover:border-accent/50 transition-all overflow-hidden flex flex-col shrink-0 w-[260px] shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
              >
                <div className="relative w-full h-32 bg-bg-soft overflow-hidden">
                  {g.cover ? (
                    <img src={g.cover} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-text-dim text-4xl font-bold">
                      {g.title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-card/95 via-bg/30 to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <div className="text-[10px] uppercase tracking-wider text-text-muted">{monthLabel}</div>
                    <div className="text-sm font-semibold leading-tight truncate">{g.title}</div>
                  </div>
                </div>
                <div className="p-3 flex-1 flex flex-col justify-between bg-bg-card">
                  <div>
                    <div className="text-2xl font-bold tabular-nums" style={{ color: colorByPct(r) }}>
                      {fmtNum(g.current_value, 1)}{g.unit ? ` ${g.unit}` : ''}
                    </div>
                    <div className="text-[11px] text-text-muted">из {fmtNum(g.target_value, 0)}{g.unit ? ` ${g.unit}` : ''}</div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={r} className="flex-1 h-1.5" barColor={colorByPct(r)} />
                    <span className="text-xs font-semibold tabular-nums" style={{ color: colorByPct(r) }}>{r}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </WidgetCard>
    ),

    'habits': () => (
      <WidgetCard editing={editing} onHide={() => hideWidget('habits')}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="mb-0">Привычки</CardTitle>
            <Button variant="ghost" size="sm" className="text-text-muted" onClick={() => nav('/habits')}>Изменить</Button>
          </div>
          <div className="space-y-3 flex-1 overflow-auto">
            {habitWeek.map(({ habit, marks, done }) => (
              <div key={habit.id} className="flex items-center gap-3">
                <div className="text-[13px] flex-1 truncate">{habit.title}</div>
                <div className="flex gap-1">
                  {marks.map((m, i) => (
                    <div key={i} className="h-2 w-2 rounded-full"
                      style={{ background: m ? habit.color ?? '#22c55e' : 'var(--border)' }} />
                  ))}
                </div>
                <div className="text-[11px] text-text-muted tabular-nums w-8 text-right">{done}/7</div>
              </div>
            ))}
            {habitWeek.length === 0 && <div className="text-xs text-text-dim">Нет привычек</div>}
          </div>
          <Button variant="ghost" className="w-full justify-between mt-3 text-text-muted" onClick={() => nav('/habits')}>
            Все привычки <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </WidgetCard>
    ),

    'focus': () => {
      const top = [...dayTasks].filter(t => t.status === 'active')
        .sort((a, b) => a.priority - b.priority).slice(0, 1);
      const focusText = top.length > 0 ? top[0].title : 'Сделай сегодня немного больше, чем вчера.';
      return (
        <WidgetCard editing={editing} onHide={() => hideWidget('focus')}>
          <div className="flex flex-col h-full">
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-3">Фокус дня</div>
            <div className="flex-1 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-accent/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-accent" />
              </div>
              <p className="text-base font-semibold leading-snug text-text">{focusText}</p>
            </div>
          </div>
        </WidgetCard>
      );
    },

    'quick-add': () => (
      <WidgetCard title="Быстрое добавление" editing={editing} onHide={() => hideWidget('quick-add')}>
        <div className="grid grid-cols-5 gap-2">
          {([
            { l: 'Задача',     i: CheckSquare, t: 'task' as const },
            { l: 'Привычка',   i: Repeat,      t: 'habit' as const },
            { l: 'Тренировка', i: Dumbbell,    t: null },
            { l: 'Заметка',    i: NotebookPen, t: null },
            { l: 'Помодоро',   i: Timer,       t: null },
          ] as { l: string; i: React.ElementType; t: 'task' | 'habit' | null }[]).map((q) => (
            <button
              key={q.l}
              onClick={() => {
                if (q.t) setQuickTab(q.t);
                else { document.querySelector<HTMLTextAreaElement>('textarea')?.focus(); }
              }}
              disabled={editing}
              className="flex flex-col items-center gap-1.5 text-text-muted hover:text-text disabled:opacity-50"
            >
              <div className="h-10 w-10 border border-border flex items-center justify-center">
                <q.i className="h-4 w-4" />
              </div>
              <span className="text-[10px]">{q.l}</span>
            </button>
          ))}
        </div>
      </WidgetCard>
    ),

    'reflection': () => (
      <WidgetCard title="Рефлексия" editing={editing} onHide={() => hideWidget('reflection')}>
        <div className="text-sm mb-3">Как прошёл твой день?</div>
        <div className="flex justify-between">
          {['😞', '😕', '😐', '🙂', '😊'].map((e, i) => (
            <button
              key={i}
              onClick={() => setMood(i)}
              disabled={editing}
              className="h-10 w-10 bg-bg-soft hover:bg-bg-hover text-xl disabled:opacity-50"
            >{e}</button>
          ))}
        </div>
      </WidgetCard>
    ),

    'kpi-grid': () => (
      <WidgetCard editing={editing} onHide={() => hideWidget('kpi-grid')}>
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="mb-0">KPI-плитки</CardTitle>
          {editing && (
            <Select onValueChange={(id) => setKpiGoals((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id])}>
              <SelectTrigger className="w-44 h-8 text-xs"><SelectValue placeholder="Добавить/убрать цель" /></SelectTrigger>
              <SelectContent>
                {goals.map((g) => (
                  <SelectItem key={g.id} value={g.id}>
                    {kpiGoals.includes(g.id) ? '✓ ' : ''}{g.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {kpiGoals.length === 0 && <div className="text-xs text-text-dim col-span-full">Нет KPI. В режиме редактора выбери цели.</div>}
          {kpiGoals.map((id) => {
            const g = goals.find((x) => x.id === id);
            if (!g) return null;
            const denom = g.target_value - g.start_value || 1;
            const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
            return (
              <div key={id} className="border border-border p-3 flex flex-col items-center gap-2">
                <Ring value={r} size={70} stroke={6} color={colorByPct(r)}>
                  <div className="text-xs font-semibold tabular-nums">{r}%</div>
                </Ring>
                <div className="text-[11px] text-center text-text-muted truncate w-full">{g.title}</div>
                <div className="text-sm tabular-nums">{fmtNum(g.current_value, 1)}{g.unit ? ` ${g.unit}` : ''}</div>
              </div>
            );
          })}
        </div>
      </WidgetCard>
    ),

    'reminders': () => (
      <WidgetCard editing={editing} onHide={() => hideWidget('reminders')}>
        <div className="flex flex-col h-full">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="mb-0">Напоминания</CardTitle>
            <Button variant="ghost" size="icon" onClick={addReminder} disabled={editing}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="space-y-2 text-sm flex-1 overflow-auto">
            {reminders.length === 0 && <div className="text-xs text-text-dim">Нет напоминаний</div>}
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={r.done}
                  onCheckedChange={() => setReminders((rs) => rs.map((x) => x.id === r.id ? { ...x, done: !x.done } : x))}
                />
                <span className={r.done ? 'flex-1 line-through text-text-muted' : 'flex-1'}>{r.text}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition-opacity"
                  onClick={() => setReminders((rs) => rs.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </WidgetCard>
    ),
  };

  return (
    <div className="sm:flex sm:items-start">
      {/* Main area */}
      <div className="sm:flex-1 min-w-0">
        <div className="p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-sm text-text-muted">
              {editing ? 'Перетаскивай и меняй размер. Нажми «Готово» чтобы сохранить.' : ''}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {editing && (
                <>
                  <Select onValueChange={applyPreset}>
                    <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="Пресет" /></SelectTrigger>
                    <SelectContent>
                      {PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {hidden.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={showAll}>Показать скрытые ({hidden.length})</Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={resetLayout}>
                    <RotateCcw className="h-3.5 w-3.5" /> Сбросить
                  </Button>
                </>
              )}
              <Button
                variant={editing ? 'default' : 'soft'}
                size="sm"
                onClick={() => setEditing((v) => !v)}
              >
                {editing ? <><Unlock className="h-3.5 w-3.5" /> Готово</> : <><Lock className="h-3.5 w-3.5" /> Редактор</>}
              </Button>
            </div>
          </div>

          <RGL
            className={editing ? 'editing' : ''}
            breakpoints={{ sm: 640, xs: 0 }}
            cols={{ sm: 12, xs: 4 }}
            layouts={{
              sm: visibleLayout,
              xs: MOBILE_LAYOUT.filter((l) => !hidden.includes(l.i)),
            }}
            rowHeight={ROW_HEIGHT}
            margin={[10, 10]}
            containerPadding={[0, 0]}
            isDraggable={editing}
            isResizable={editing}
            onLayoutChange={(_cur: Layout[], all: Record<string, Layout[]>) => {
              if (!editing) return;
              const next = all.sm ?? [];
              const merged = layout.map((it) => next.find((n: Layout) => n.i === it.i) ?? it);
              setLayout(merged);
            }}
            draggableCancel="button,input,textarea,label,a,select"
          >
            {visibleLayout.map((l) => (
              <div key={l.i} className="bento-item">
                {widgets[l.i]?.()}
              </div>
            ))}
          </RGL>
        </div>
      </div>

      {/* Sticky right panel */}
      <div className="hidden lg:flex w-[300px] shrink-0 border-l border-border flex-col bg-bg-card sticky top-0 max-h-[calc(100vh-64px)] overflow-y-auto">
        {/* Progress Goals */}
        <div className="p-4 border-b border-border">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-3 font-medium">Прогресс целей</div>
          <div className="flex flex-col items-center gap-3">
            <Ring value={overallGoalProgress} size={120} stroke={10} color={colorByPct(overallGoalProgress)}>
              <div className="text-center">
                <div className="text-2xl font-semibold">{overallGoalProgress}%</div>
                <div className="text-[11px] text-text-muted">Общий</div>
              </div>
            </Ring>
            {velocityHint !== null && (
              <div className="text-center text-xs">
                {velocityHint > 0 && <span className="text-accent">↗ ускорение +{velocityHint}% к прошлой неделе</span>}
                {velocityHint === 0 && <span className="text-text-muted">→ темп без изменений</span>}
                {velocityHint < 0 && <span className="text-danger">↘ отстаёшь {velocityHint}% от прошлой недели</span>}
              </div>
            )}
          </div>
          <Button variant="ghost" className="w-full justify-between mt-3 text-text-muted" onClick={() => nav('/goals')}>
            Все цели <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Statistics */}
        <div className="p-4 border-b border-border">
          <div className="text-[11px] uppercase tracking-wider text-text-muted mb-3 font-medium">Статистика</div>
          <div className="space-y-3">
            {fitnessStats.map((s) => (
              <div key={s.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-text-muted">{s.label}</span>
                  <span className="tabular-nums text-text">{fmtNum(s.cur, 1)} / {fmtNum(s.max, 0)}{s.unit ?? ''}</span>
                </div>
                <Progress value={(s.cur / s.max) * 100} barColor={colorByPct((s.cur / s.max) * 100)} />
              </div>
            ))}
          </div>
          <Button variant="ghost" className="w-full justify-between mt-3 text-text-muted" onClick={() => nav('/analytics')}>
            Вся статистика <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Habits */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-text-muted font-medium">Привычки</div>
            <Button variant="ghost" size="sm" className="text-text-muted h-6 px-2 text-xs" onClick={() => nav('/habits')}>
              Изменить
            </Button>
          </div>
          <div className="space-y-2.5">
            {habitWeek.slice(0, 6).map(({ habit, marks, done }) => (
              <div key={habit.id} className="flex items-center gap-2">
                <div className="text-[12px] flex-1 truncate text-text">{habit.title}</div>
                <div className="flex gap-0.5">
                  {marks.map((m, i) => (
                    <div key={i} className="h-2 w-2 rounded-full"
                      style={{ background: m ? habit.color ?? 'var(--accent)' : 'var(--border)' }} />
                  ))}
                </div>
                <div className="text-[10px] text-text-muted tabular-nums w-6 text-right">{done}/7</div>
              </div>
            ))}
            {habitWeek.length === 0 && <div className="text-xs text-text-dim">Нет привычек</div>}
          </div>
          {habitWeek.length > 0 && (
            <Button variant="ghost" className="w-full justify-between mt-3 text-text-muted" onClick={() => nav('/habits')}>
              Все привычки <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Reminders */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] uppercase tracking-wider text-text-muted font-medium">Напоминания</div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={addReminder}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            {reminders.length === 0 && <div className="text-xs text-text-dim">Нет напоминаний</div>}
            {reminders.map((r) => (
              <div key={r.id} className="flex items-center gap-2 group">
                <Checkbox
                  checked={r.done}
                  onCheckedChange={() => setReminders((rs) => rs.map((x) => x.id === r.id ? { ...x, done: !x.done } : x))}
                />
                <span className={r.done ? 'flex-1 line-through text-text-muted text-[13px]' : 'flex-1 text-[13px]'}>{r.text}</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-text-dim hover:text-danger transition-opacity"
                  onClick={() => setReminders((rs) => rs.filter((x) => x.id !== r.id))}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <QuickAddDialog
        open={quickTab !== null}
        onOpenChange={(v) => !v && setQuickTab(null)}
        date={date}
        initialTab={quickTab ?? undefined}
      />
    </div>
  );
};

const WidgetCard: React.FC<{
  title?: string;
  editing: boolean;
  onHide?: () => void;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ title, editing, onHide, onClick, children }) => (
  <div
    className={`relative h-full p-4 border flex flex-col overflow-hidden transition-all ${editing ? 'border-dashed border-border/50 bg-bg-soft/20' : 'bg-bg-card border-border hover:border-border-soft/80'} ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    {title && <div className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-3 shrink-0">{title}</div>}
    <div className="flex-1 min-h-0">{children}</div>
    {editing && onHide && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onHide(); }}
        className="absolute top-1 right-1 p-1 text-text-muted hover:text-danger bg-bg z-10"
        title="Скрыть"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);
