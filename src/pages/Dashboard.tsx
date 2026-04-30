import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import GridLayout, { WidthProvider, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const RGL = WidthProvider(GridLayout);
import { CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Ring } from '@/components/ui/ring';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Plus, ChevronRight, Sun, Moon, Lock, Unlock, RotateCcw, Trash2,
  CheckSquare, Repeat, Activity, NotebookPen, Gauge,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate, fmtNum } from '@/lib/utils';
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
  { i: 'goals-week',    x: 0,  y: 0,  w: 9, h: 5 },
  { i: 'progress-ring', x: 9,  y: 0,  w: 3, h: 5 },
  { i: 'block-morning', x: 0,  y: 5,  w: 2, h: 5 },
  { i: 'block-day',     x: 2,  y: 5,  w: 2, h: 5 },
  { i: 'block-evening', x: 4,  y: 5,  w: 2, h: 5 },
  { i: 'block-night',   x: 6,  y: 5,  w: 2, h: 5 },
  { i: 'notes',         x: 8,  y: 5,  w: 2, h: 5 },
  { i: 'stats',         x: 10, y: 5,  w: 2, h: 5 },
  { i: 'plan-future',   x: 0,  y: 10, w: 9, h: 5 },
  { i: 'habits',        x: 9,  y: 10, w: 3, h: 5 },
  { i: 'focus',         x: 0,  y: 15, w: 3, h: 4 },
  { i: 'quick-add',     x: 3,  y: 15, w: 3, h: 4 },
  { i: 'reflection',    x: 6,  y: 15, w: 3, h: 4 },
  { i: 'reminders',     x: 9,  y: 15, w: 3, h: 4 },
  { i: 'kpi-grid',      x: 0,  y: 19, w: 12, h: 5 },
];

const ROW_HEIGHT = 48;

export const Dashboard: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { goals, tasks, habits, habitLogs, toggleTask, addProgress, upsertReflection } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const today = isoDate(date);

  const [layout, setLayout] = useLocalStorage<Layout[]>('dashboard.layout.v2', DEFAULT_LAYOUT);
  const [editing, setEditing] = useState(false);
  const [hidden, setHidden] = useLocalStorage<string[]>('dashboard.hidden.v2', []);
  const [notes, setNotes] = useLocalStorage<Record<string, string>>('dashboard.notes', {});
  const [reminders, setReminders] = useLocalStorage<{ id: string; text: string; done: boolean }[]>(
    'dashboard.reminders',
    [
      { id: 'r1', text: 'Тренировка в 18:00', done: false },
      { id: 'r2', text: 'Медитация в 21:30', done: false },
    ],
  );
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | 'goal' | 'progress' | null>(null);
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
      data: weekStats.arr.map((x, i) => {
        const v = x.total ? Math.round((x.done / x.total) * 100) : 0;
        let color = cc.emptyBar;
        if (i === weekStats.bestI && x.total) color = '#22c55e';
        else if (i === weekStats.worstI && x.total) color = '#ef4444';
        else if (v >= 60) color = '#eab308';
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
        <div className="grid grid-cols-12 gap-4 h-full">
          <div className="col-span-4">
            <ol className="space-y-2.5">
              {goals.slice(0, 5).map((g, i) => {
                const denom = g.target_value - g.start_value || 1;
                const r = Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
                const done = r >= 1;
                return (
                  <li key={g.id} className="flex items-center gap-3 text-sm">
                    <span className="text-text-dim w-3">{i + 1}</span>
                    <span className="flex-1 truncate">{g.title}</span>
                    <Checkbox checked={done} onCheckedChange={() => toggleGoalDone(g.id)} />
                  </li>
                );
              })}
            </ol>
          </div>
          <div className="col-span-3 flex flex-col items-center justify-center">
            <Ring value={weekDoneRatio} size={130} stroke={10} color="var(--text)">
              <div className="text-center">
                <div className="text-2xl font-semibold">{weekDoneRatio}%</div>
                <div className="text-[11px] text-text-muted">Неделя</div>
              </div>
            </Ring>
          </div>
          <div className="col-span-2 flex flex-col justify-center text-sm space-y-1.5">
            <Row label="Всего" value={String(weekStats.total)} />
            <Row label="Готово" value={String(weekStats.done)} />
            <Row label="Осталось" value={String(weekStats.total - weekStats.done)} />
            <Row label="Лучший" value={dayName(weekStats.bestI)} valueClass="text-accent" />
            <Row label="Худший" value={dayName(weekStats.worstI)} valueClass="text-danger" />
          </div>
          <div className="col-span-3 min-w-0">
            <ECharts option={weekChartOpt} height={160} />
          </div>
        </div>
      </WidgetCard>
    ),

    'progress-ring': () => (
      <WidgetCard title="Прогресс целей" editing={editing} onHide={() => hideWidget('progress-ring')}>
        <div className="flex flex-col h-full">
          <div className="flex-1 flex items-center justify-center">
            <Ring value={overallGoalProgress} size={140} stroke={10}>
              <div className="text-center">
                <div className="text-2xl font-semibold">{overallGoalProgress}%</div>
                <div className="text-[11px] text-text-muted">Общий</div>
              </div>
            </Ring>
          </div>
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
              <div className="space-y-2 flex-1 overflow-auto">
                {blockTasks.length === 0 && <div className="text-xs text-text-dim">Нет задач</div>}
                {blockTasks.map((t) => (
                  <label key={t.id} className="flex items-center gap-2.5 text-[13px] cursor-pointer">
                    <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
                    <span className={t.status === 'done' ? 'text-text-muted line-through' : ''}>{t.title}</span>
                  </label>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-soft">
                <div>
                  <div className="text-[11px] text-text-muted">Выполнено</div>
                  <div className="text-sm">{done}/{blockTasks.length}</div>
                </div>
                <Ring value={ratio} size={42} stroke={4} color="var(--text)">
                  <div className="text-[10px]">{ratio}%</div>
                </Ring>
              </div>
            </div>
          </WidgetCard>
        );
      },
    ])) as Record<string, () => React.ReactNode>,

    'notes': () => (
      <WidgetCard title="Заметка на день" editing={editing} onHide={() => hideWidget('notes')}>
        <textarea
          className="w-full h-full bg-transparent text-xs text-text resize-none outline-none border-0"
          value={notes[today] ?? ''}
          onChange={(e) => setNotes({ ...notes, [today]: e.target.value })}
          placeholder="Запиши мысли дня..."
        />
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
                <Progress value={(s.cur / s.max) * 100} className="mt-1.5" />
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
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 h-full">
          {planGoals.map((g) => {
            const denom = g.target_value - g.start_value || 1;
            const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
            const monthLabel = g.deadline ? format(new Date(g.deadline), 'LLLL yyyy', { locale: ru }) : '—';
            return (
              <button
                key={g.id}
                onClick={() => !editing && nav('/goals')}
                className="text-left border border-transparent hover:border-border transition-colors overflow-hidden"
              >
                {g.cover && <img src={g.cover} alt="" className="w-full h-20 object-cover" />}
                <div className="p-3">
                  <div className="text-[11px] text-text-muted">{monthLabel}</div>
                  <div className="text-sm font-medium mt-1 truncate">{g.title}</div>
                  <div className="mt-2 text-2xl font-semibold tabular-nums">
                    {fmtNum(g.current_value, 1)}{g.unit ? ` ${g.unit}` : ''}
                  </div>
                  <div className="text-[11px] text-text-muted">цель {fmtNum(g.target_value, 0)}{g.unit ? ` ${g.unit}` : ''}</div>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={r} className="flex-1" />
                    <span className="text-[11px] text-text-muted tabular-nums">{r}%</span>
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

    'focus': () => (
      <WidgetCard title="Фокус дня" editing={editing} onHide={() => hideWidget('focus')}>
        <p className="text-sm text-text-muted leading-relaxed">
          Сделай сегодня немного больше, чем вчера, и это изменит твоё завтра.
        </p>
      </WidgetCard>
    ),

    'quick-add': () => (
      <WidgetCard title="Быстрое добавление" editing={editing} onHide={() => hideWidget('quick-add')}>
        <div className="grid grid-cols-5 gap-2">
          {([
            { l: 'Задача', i: CheckSquare, t: 'task' as const },
            { l: 'Привычка', i: Repeat, t: 'habit' as const },
            { l: 'Цель', i: Activity, t: 'goal' as const },
            { l: 'Заметка', i: NotebookPen, t: null },
            { l: 'Показатель', i: Gauge, t: 'progress' as const },
          ]).map((q) => (
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
                <Ring value={r} size={70} stroke={6}>
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
    <div className="p-4">
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
        layout={visibleLayout}
        cols={12}
        rowHeight={ROW_HEIGHT}
        margin={[12, 12]}
        containerPadding={[0, 0]}
        isDraggable={editing}
        isResizable={editing}
        onLayoutChange={(next) => {
          if (!editing) return;
          const merged = layout.map((it) => next.find((n) => n.i === it.i) ?? it);
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
    className={`relative h-full p-4 border transition-colors ${editing ? 'border-dashed border-border bg-bg-soft/30' : 'border-transparent hover:border-border'} ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
  >
    {title && <CardTitle>{title}</CardTitle>}
    <div className="h-full">{children}</div>
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
