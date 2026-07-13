import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Responsive, type Layout } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

/** Ширина сетки через ResizeObserver: WidthProvider мерит до применения
 *  стилей и не замечает появление правого рейла. */
function useContainerWidth() {
  // callback-ref: контейнер появляется позже (после пустого экрана), поэтому
  // замер нужно переподключать на каждое присоединение узла, а не один раз на маунте
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!el) return;
    // Синхронный замер сразу (RO в фоновых вкладках может молчать) + RO/resize для изменений
    const measure = () => setW(el.getBoundingClientRect().width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener('resize', measure);
    return () => { ro.disconnect(); window.removeEventListener('resize', measure); };
  }, [el]);
  return [setEl, w] as const;
}
import { CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Ring } from '@/components/ui/ring';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Plus, ChevronRight, Sun, Moon, Lock, Unlock, RotateCcw, Trash2,
  CheckSquare, Repeat, NotebookPen, Dumbbell, Timer, Target, Maximize2,
  Cloud, CloudFog, CloudDrizzle, CloudRain, CloudSnow, CloudLightning, Medal,
} from 'lucide-react';
import { getWeather, type Weather } from '@/lib/weather';
import { useStore } from '@/lib/store';
import { isoDate, fmtNum, colorByPct } from '@/lib/utils';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ECharts } from '@/components/charts/ECharts';
import { useTheme } from '@/lib/theme';
import { getChartColors } from '@/lib/chart-theme';
import { useLocalStorage } from '@/lib/useLocalStorage';
import { QuickAddDialog } from '@/components/QuickAddDialog';
import { forecastGoal } from '@/lib/predict';
import { QUEST_POOL, loadOrGenerate as loadQuests, save as saveQuests, effectiveTarget } from '@/lib/quests';
import { WEEKLY_POOL, loadOrGenerate as loadWeekly, save as saveWeekly, buildContext as buildWeeklyCtx } from '@/lib/weekly';
import { xpInWeek, leagueFor, nextLeague, buildHistory } from '@/lib/leagues';
import { pickLetter, lastShownDate, markShown } from '@/lib/letters';
import { computeStreak, levelFromXp, xpToday, xpTotal } from '@/lib/gamification';
import { Mascot } from '@/components/Mascot';
import { PRESETS } from '@/lib/dashboardPresets';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { WIDGET_CATALOG, type WidgetMeta } from '@/lib/widgetCatalog';
import { getInstalledPlugins, PLUGINS_EVENT, type PluginWidgetDef } from '@/lib/plugins';
import { WidgetPicker } from '@/components/dashboard/WidgetPicker';
import { PluginWidget, PLUGIN_ICONS } from '@/components/dashboard/PluginWidget';
import { Puzzle } from 'lucide-react';
import { TodayFocus } from '@/components/dashboard/TodayFocus';
import { DayBrief } from '@/components/dashboard/DayBrief';
import { TodayPlanList } from '@/components/dashboard/TodayPlanList';
import { HabitDots } from '@/components/dashboard/HabitDots';
import { WeeklyConsistency } from '@/components/dashboard/WeeklyConsistency';
import { TimeAllocation } from '@/components/dashboard/TimeAllocation';
import { WeekProgressChart } from '@/components/dashboard/WeekProgressChart';
import { GoalsProgress } from '@/components/dashboard/GoalsProgress';
import { UpcomingEvents } from '@/components/dashboard/UpcomingEvents';
import { QuickCapture } from '@/components/dashboard/QuickCapture';
import { HealthWidget } from '@/components/dashboard/HealthWidget';
import { CalendarWidget } from '@/components/dashboard/CalendarWidget';
import { WorkoutWidget } from '@/components/dashboard/WorkoutWidget';
import { CaloriesWidget } from '@/components/dashboard/CaloriesWidget';
import { ActivityWidget } from '@/components/dashboard/ActivityWidget';
import { EmptyDashboard } from '@/components/dashboard/EmptyDashboard';
import { quoteOfDay } from '@/lib/quotes';
import { getUserName } from '@/lib/onboarding';
import { Sparkles } from 'lucide-react';

const BLOCKS = [
  { key: 'morning', label: '06:00 – 12:00', icon: Sun },
  { key: 'day', label: '12:00 – 16:00', icon: Sun },
  { key: 'evening', label: '16:00 – 20:00', icon: Sun },
  { key: 'night', label: '20:00 – 23:00', icon: Moon },
] as const;

// Раскладка по макету: жёсткие min/max держат пропорции карточек
const DEFAULT_LAYOUT: Layout[] = [
  // Ряд 1: фокус дня + сводка (правее — фиксированный рейл с AI-коучем)
  { i: 'today-focus',    x: 0, y: 0,  w: 7, h: 5, minW: 4, minH: 4, maxH: 7 },
  { i: 'day-brief',      x: 7, y: 0,  w: 5, h: 5, minW: 3, minH: 4, maxH: 7 },
  // Ряд 2: план · привычки · постоянство
  { i: 'today-plan',     x: 0, y: 5,  w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'habit-dots',     x: 4, y: 5,  w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'consistency',    x: 8, y: 5,  w: 4, h: 6, minW: 3, minH: 4 },
  // Ряд 3: графики
  { i: 'time-alloc',     x: 0, y: 11, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  { i: 'week-progress',  x: 4, y: 11, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  { i: 'goals-progress', x: 8, y: 11, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  // В рейле по умолчанию, но доступны и как виджеты сетки
  { i: 'upcoming',       x: 0, y: 16, w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'quick-capture',  x: 4, y: 16, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  { i: 'health',         x: 8, y: 16, w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'calendar',       x: 0, y: 22, w: 4, h: 7, minW: 3, minH: 6 },
  { i: 'workout',        x: 4, y: 22, w: 4, h: 6, minW: 3, minH: 5 },
  { i: 'calories',       x: 8, y: 22, w: 4, h: 6, minW: 3, minH: 5 },
  { i: 'activity',       x: 8, y: 28, w: 4, h: 6, minW: 3, minH: 5 },
  // Дополнительные виджеты (скрыты по умолчанию, включаются в редакторе)
  { i: 'goals-week',    x: 0,  y: 16, w: 12, h: 6, minW: 6, minH: 5 },
  { i: 'block-morning', x: 0,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'block-day',     x: 3,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'block-evening', x: 6,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'block-night',   x: 9,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'notes',         x: 0,  y: 29, w: 4,  h: 5, minW: 3, minH: 4 },
  { i: 'plan-future',   x: 0,  y: 34, w: 12, h: 5, minW: 6, minH: 5, maxH: 6 },
  { i: 'focus',         x: 0,  y: 39, w: 6,  h: 4, minW: 4, minH: 4 },
  { i: 'quests',        x: 6,  y: 39, w: 3,  h: 4, minW: 3, minH: 4 },
  { i: 'weekly-challenge', x: 9, y: 39, w: 3, h: 4, minW: 3, minH: 4 },
  { i: 'letter',        x: 0,  y: 43, w: 6,  h: 4, minW: 4, minH: 3 },
  { i: 'quick-add',     x: 6,  y: 43, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'reflection',    x: 9,  y: 43, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'kpi-grid',      x: 0,  y: 47, w: 6,  h: 4, minW: 4, minH: 4 },
  { i: 'reminders',     x: 6,  y: 47, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'coach',         x: 9,  y: 47, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'leagues',       x: 0,  y: 51, w: 12, h: 4, minW: 6, minH: 4 },
];

// Скрыты по умолчанию — включаются через «Показать скрытые» в редакторе
const DEFAULT_HIDDEN = [
  'goals-week', 'block-morning', 'block-day', 'block-evening', 'block-night',
  'notes', 'plan-future', 'focus', 'quests', 'weekly-challenge', 'letter',
  'quick-add', 'kpi-grid', 'reminders', 'leagues', 'coach',
];

// Mobile layout: single-column (4 cols), stacked vertically
const MOBILE_LAYOUT: Layout[] = [
  { i: 'today-focus',    x: 0, y: 0,  w: 4, h: 5 },
  { i: 'day-brief',      x: 0, y: 5,  w: 4, h: 5 },
  { i: 'health',         x: 0, y: 9, w: 4, h: 6 },
  { i: 'today-plan',     x: 0, y: 10, w: 4, h: 6 },
  { i: 'habit-dots',     x: 0, y: 16, w: 4, h: 6 },
  { i: 'consistency',    x: 0, y: 22, w: 4, h: 6 },
  { i: 'time-alloc',     x: 0, y: 28, w: 4, h: 5 },
  { i: 'week-progress',  x: 0, y: 33, w: 4, h: 5 },
  { i: 'goals-progress', x: 0, y: 38, w: 4, h: 5 },
];

const ROW_HEIGHT = 48;

// Виджет → страница, которую он раскрывает по клику на ⤢ (навигация через виджеты)
const WIDGET_PAGE: Record<string, string> = {
  'today-focus': 'plan',
  'today-plan': 'tasks',
  'habit-dots': 'habits',
  'consistency': 'analytics',
  'time-alloc': 'analytics',
  'week-progress': 'analytics',
  'goals-progress': 'goals',
  'goals-week': 'goals',
  'kpi-grid': 'goals',
  'upcoming': 'calendar',
  'calendar': 'calendar',
  'health': 'health',
  'reflection': 'reflection',
  'quests': 'awards',
  'weekly-challenge': 'awards',
  'leagues': 'awards',
  'plan-future': 'goals',
};

const openPage = (page: string) => window.dispatchEvent(new CustomEvent('thedad:expand', { detail: { page } }));

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

const WEATHER_ICON: Record<Weather['kind'], React.ElementType> = {
  clear: Sun, cloudy: Cloud, fog: CloudFog, drizzle: CloudDrizzle,
  rain: CloudRain, snow: CloudSnow, storm: CloudLightning,
};

const WeatherChip: React.FC = () => {
  const [w, setW] = useState<Weather | null>(null);
  useEffect(() => {
    let on = true;
    void getWeather().then((x) => { if (on) setW(x); });
    return () => { on = false; };
  }, []);
  const hour = new Date().getHours();
  const Icon = w ? WEATHER_ICON[w.kind] : hour >= 6 && hour < 21 ? Sun : Moon;
  const clear = !w || w.kind === 'clear';
  return (
    <span className="inline-flex items-center gap-1.5 align-middle shrink-0">
      <Icon className={`h-6 w-6 ${clear ? 'text-warning' : 'text-text-muted'}`} />
      {w && <span className="text-lg font-medium tabular-nums text-text-muted">{w.temp}°</span>}
    </span>
  );
};

export const Dashboard: React.FC<{ date: Date; onStartFocus?: () => void }> = ({ date, onStartFocus }) => {
  const nav = useNavigate();
  const { goals, tasks, habits, habitLogs, progress, reflections, timeEntries, xpLog, toggleTask, addProgress, upsertReflection, awardXp } = useStore();
  const { theme } = useTheme();
  const cc = getChartColors(theme === 'dark');
  const today = isoDate(date);

  const [gridRef, gridW] = useContainerWidth();
  const [layout, setLayout] = useLocalStorage<Layout[]>('dashboard.layout.v8', DEFAULT_LAYOUT);
  // Новые виджеты из DEFAULT_LAYOUT доезжают в сохранённую раскладку старых пользователей
  useEffect(() => {
    const missing = DEFAULT_LAYOUT.filter((d) => !layout.some((l) => l.i === d.i));
    if (missing.length) setLayout([...layout, ...missing]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [editing, setEditingRaw] = useState(false);
  const [backup, setBackup] = useState<Layout[] | null>(null);
  const enterEditor = () => { setBackup(JSON.parse(JSON.stringify(layout))); setEditingRaw(true); };
  const exitEditor = () => {
    if (backup) {
      const changed = JSON.stringify(backup) !== JSON.stringify(layout);
      if (changed && !window.confirm('Сохранить изменения раскладки?')) {
        setLayout(backup);
      }
    }
    setBackup(null);
    setEditingRaw(false);
  };
  const revertToBackup = () => { if (backup) { setLayout(backup); } };
  const [hidden, setHidden] = useLocalStorage<string[]>('dashboard.hidden.v6', DEFAULT_HIDDEN);
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

  const resetLayout = () => { setLayout(DEFAULT_LAYOUT); setHidden(DEFAULT_HIDDEN); };
  const hideWidget = (id: string) => setHidden((h) => [...new Set([...h, id])]);

  // Жёсткий минимум размеров: ниже виджет не ужать (и сохранённые раскладки подтягиваем к полу).
  const MIN_W = 3, MIN_H = 3;
  const minsFor = (id: string) => {
    const meta = WIDGET_CATALOG.find((m) => m.id === id);
    return { minW: Math.max(meta?.minW ?? MIN_W, MIN_W), minH: Math.max(meta?.minH ?? MIN_H, MIN_H) };
  };
  const visibleLayout = layout
    .filter((l) => !hidden.includes(l.i))
    .map((l) => {
      const { minW, minH } = minsFor(l.i);
      return { ...l, minW, minH, w: Math.max(l.w, minW), h: Math.max(l.h, minH) };
    });

  /* === Добавление виджетов: плитка «+» в конце сетки → окно выбора === */
  const [pickerOpen, setPickerOpen] = useState(false);
  const [plugins, setPlugins] = useState<PluginWidgetDef[]>(getInstalledPlugins);
  useEffect(() => {
    const sync = () => setPlugins(getInstalledPlugins());
    window.addEventListener(PLUGINS_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => { window.removeEventListener(PLUGINS_EVENT, sync); window.removeEventListener('storage', sync); };
  }, []);
  // Удалённый плагин убираем и из раскладки
  useEffect(() => {
    const ids = new Set(plugins.map((p) => `plugin:${p.id}`));
    if (layout.some((l) => l.i.startsWith('plugin:') && !ids.has(l.i))) {
      setLayout(layout.filter((l) => !l.i.startsWith('plugin:') || ids.has(l.i)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plugins]);

  const pluginMetas: WidgetMeta[] = plugins.map((p) => ({
    id: `plugin:${p.id}`,
    label: p.name,
    description: `Плагин${p.author ? ` · ${p.author}` : ''}`,
    category: 'plugins',
    icon: PLUGIN_ICONS[p.icon ?? ''] ?? Puzzle,
    w: p.defaultSize?.w ?? 4,
    h: p.defaultSize?.h ?? 5,
    minW: 2,
    minH: 3,
  }));

  const visibleIds = new Set(visibleLayout.map((l) => l.i));
  const availableWidgets = [...WIDGET_CATALOG, ...pluginMetas].filter((m) => !visibleIds.has(m.id));

  const addWidget = (meta: WidgetMeta) => {
    setHidden((h) => h.filter((x) => x !== meta.id));
    setLayout((l) => {
      if (l.some((it) => it.i === meta.id)) return l;
      const bottom = l.reduce((m, it) => Math.max(m, it.y + it.h), 0);
      return [...l, { i: meta.id, x: 0, y: bottom, w: meta.w, h: meta.h, minW: meta.minW, minH: meta.minH }];
    });
  };

  const quote = quoteOfDay();

  // Each widget is a function returning JSX. The grid item wraps it with the card frame.
  // Фабрика: параметр editing затеняет внешний стейт, чтобы те же виджеты рендерились
  // «начисто» (editing=false) как живые превью в окне выбора виджетов.
  const buildWidgets = (editing: boolean): Record<string, () => React.ReactNode> => ({
    // === Основные виджеты (по макету) — рендерят собственную карточку ===
    'today-focus': () => (
      <Cell editing={editing} onHide={() => hideWidget('today-focus')}>
        <TodayFocus date={date} onStartFocus={() => onStartFocus?.()} />
      </Cell>
    ),
    'day-brief': () => (
      <Cell editing={editing} onHide={() => hideWidget('day-brief')}>
        <DayBrief date={date} />
      </Cell>
    ),
    'coach': () => (
      <Cell editing={editing} onHide={() => hideWidget('coach')}>
        <div className="h-full rounded-xl border border-accent/20 bg-gradient-to-br from-accent/10 to-accent/5 p-5 flex flex-col overflow-hidden">
          <div className="flex items-center gap-1.5 text-label text-accent mb-3 shrink-0">
            <Sparkles className="h-3.5 w-3.5" /> Коуч дня
          </div>
          <blockquote className="text-sm text-text leading-relaxed">«{quote.text}»</blockquote>
          <div className="text-xs text-text-muted mt-2">— {quote.author}</div>
        </div>
      </Cell>
    ),
    'today-plan': () => (
      <Cell editing={editing} onHide={() => hideWidget('today-plan')}>
        <TodayPlanList date={date} />
      </Cell>
    ),
    'habit-dots': () => (
      <Cell editing={editing} onHide={() => hideWidget('habit-dots')}>
        <HabitDots date={date} />
      </Cell>
    ),
    'consistency': () => (
      <Cell editing={editing} onHide={() => hideWidget('consistency')}>
        <WeeklyConsistency />
      </Cell>
    ),
    'upcoming': () => (
      <Cell editing={editing} onHide={() => hideWidget('upcoming')}>
        <UpcomingEvents date={date} />
      </Cell>
    ),
    'time-alloc': () => (
      <Cell editing={editing} onHide={() => hideWidget('time-alloc')}>
        <TimeAllocation date={date} />
      </Cell>
    ),
    'week-progress': () => (
      <Cell editing={editing} onHide={() => hideWidget('week-progress')}>
        <WeekProgressChart date={date} />
      </Cell>
    ),
    'goals-progress': () => (
      <Cell editing={editing} onHide={() => hideWidget('goals-progress')}>
        <GoalsProgress />
      </Cell>
    ),
    'quick-capture': () => (
      <Cell editing={editing} onHide={() => hideWidget('quick-capture')}>
        <QuickCapture date={date} />
      </Cell>
    ),
    'health': () => (
      <Cell editing={editing} onHide={() => hideWidget('health')}>
        <HealthWidget date={date} />
      </Cell>
    ),
    'calendar': () => (
      <Cell editing={editing} onHide={() => hideWidget('calendar')}>
        <CalendarWidget date={date} />
      </Cell>
    ),
    'workout': () => (
      <Cell editing={editing} onHide={() => hideWidget('workout')}>
        <WorkoutWidget />
      </Cell>
    ),
    'calories': () => (
      <Cell editing={editing} onHide={() => hideWidget('calories')}>
        <CaloriesWidget />
      </Cell>
    ),
    'activity': () => (
      <Cell editing={editing} onHide={() => hideWidget('activity')}>
        <ActivityWidget />
      </Cell>
    ),

    // === Дополнительные виджеты (скрыты по умолчанию) ===
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
          {/* Большое число выполненных задач — заменяет слабый бар */}
          <div className="hidden sm:flex sm:col-span-3 flex-col justify-center items-end pr-2">
            <div className="text-[10px] uppercase tracking-wider text-text-muted">Сделано за неделю</div>
            <div className="text-5xl font-bold tabular-nums leading-none" style={{ color: colorByPct(weekDoneRatio) }}>
              {weekStats.done}<span className="text-text-dim text-2xl">/{weekStats.total || 0}</span>
            </div>
            {velocityHint !== null && (
              <div className="text-xs mt-1">
                {velocityHint > 0 && <span className="text-accent">↗ +{velocityHint}% к прошлой неделе</span>}
                {velocityHint === 0 && <span className="text-text-muted">→ темп прежний</span>}
                {velocityHint < 0 && <span className="text-danger">↘ {velocityHint}% к прошлой неделе</span>}
              </div>
            )}
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
              {/* Block header */}
              <div className="flex items-center justify-between mb-3 shrink-0">
                <div className="flex items-center gap-2">
                  <b.icon className="h-3.5 w-3.5 text-accent" strokeWidth={2} />
                  <span className="text-[11px] font-semibold text-text-muted tracking-wider uppercase">{b.label}</span>
                </div>
                <span className="text-[10px] text-text-dim tabular-nums">{done}/{blockTasks.length}</span>
              </div>

              {/* Task list */}
              <div className="flex-1 overflow-auto -mx-1 space-y-0.5">
                {blockTasks.length === 0 && (
                  <div className="flex items-center justify-center h-16 text-xs text-text-dim">
                    Нет задач
                  </div>
                )}
                {[...blockTasks]
                  .sort((a, bT) => (a.start_time ?? '').localeCompare(bT.start_time ?? ''))
                  .map((t) => (
                    <label
                      key={t.id}
                      className={`task-row${t.status === 'done' ? ' task-done' : ''}`}
                    >
                      <Checkbox
                        checked={t.status === 'done'}
                        onCheckedChange={() => toggleTask(t.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-sm font-medium leading-none truncate transition-all duration-200 ${t.status === 'done' ? 'line-through text-text-dim' : 'text-text'}`}>
                          {t.title}
                        </div>
                        {t.start_time && (
                          <div className="text-[10px] text-text-dim tabular-nums mt-1">{t.start_time}</div>
                        )}
                      </div>
                    </label>
                  ))}
              </div>

              {/* Footer progress */}
              <div className="shrink-0 mt-3 pt-3" style={{ borderTop: '1px solid var(--border-soft)' }}>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1 bg-bg-soft overflow-hidden" style={{ borderRadius: '2px' }}>
                    <div
                      className="h-full progress-bar"
                      style={{
                        width: `${ratio}%`,
                        background: ratio === 100
                          ? 'var(--accent)'
                          : `linear-gradient(90deg, var(--accent) 0%, rgba(132,204,22,0.6) 100%)`,
                        boxShadow: ratio > 0 ? '0 0 8px rgba(132,204,22,0.4)' : undefined,
                      }}
                    />
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: ratio > 0 ? 'var(--accent)' : 'var(--text-dim)' }}>
                    {ratio}%
                  </span>
                </div>
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
        <div className="flex gap-4 overflow-x-auto h-full pb-1" style={{ scrollbarWidth: 'none' }}>
          {planGoals.length === 0 && (
            <div className="flex-1 flex items-center justify-center text-xs text-text-dim">
              Нет целей — добавь первую цель
            </div>
          )}
          {planGoals.map((g) => {
            const denom = g.target_value - g.start_value || 1;
            const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
            const monthLabel = g.deadline ? format(new Date(g.deadline), 'LLLL yyyy', { locale: ru }) : '';
            const colorHex = r >= 80 ? '#84CC16' : r >= 50 ? '#F59E0B' : r >= 20 ? '#F97316' : '#6B7280';
            const recs = progress.filter((p) => p.goal_id === g.id);
            const fc = forecastGoal(g, recs, 30);
            let etaHint: { text: string; tone: 'good' | 'bad' | 'neutral' } | null = null;
            if (g.deadline && fc.etaDate) {
              const days = Math.round((Date.parse(fc.etaDate) - Date.parse(g.deadline)) / 86400000);
              if (days < -2) etaHint = { text: `опережаешь на ${-days} дн.`, tone: 'good' };
              else if (days > 2) etaHint = { text: `отстаёшь на ${days} дн.`, tone: 'bad' };
              else etaHint = { text: 'идёшь по графику', tone: 'neutral' };
            } else if (g.deadline && !fc.etaDate && recs.length < 2) {
              etaHint = { text: 'мало данных для прогноза', tone: 'neutral' };
            }
            return (
              /* Карточка цели в новой дизайн-системе: спокойная поверхность, тонкая
                 граница, hover-lift из CSS — без тяжёлых теней и JS-ховеров */
              <button
                key={g.id}
                onClick={() => !editing && nav('/goals')}
                className="shrink-0 w-[230px] text-left rounded-xl border border-border-soft bg-bg-soft/60 overflow-hidden hover-lift flex flex-col"
              >
                {/* Обложка или монограмма */}
                <div className="relative h-20 shrink-0 overflow-hidden">
                  {g.cover ? (
                    <img src={g.cover} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-4xl font-black"
                      style={{ background: `linear-gradient(135deg, ${colorHex}1f 0%, ${colorHex}08 100%)`, color: `${colorHex}55` }}
                    >
                      {g.title.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  {monthLabel && (
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-black/40 backdrop-blur px-2 py-0.5 text-[9px] uppercase tracking-wider font-semibold text-white capitalize">
                      {monthLabel}
                    </span>
                  )}
                </div>
                {/* Контент */}
                <div className="flex-1 flex flex-col p-3">
                  <div className="text-sm font-semibold text-text truncate leading-tight">{g.title}</div>
                  <div className="text-xl font-bold tabular-nums mt-1" style={{ color: colorHex }}>
                    {fmtNum(g.current_value, 1)}{g.unit ? ` ${g.unit}` : ''}
                    <span className="text-xs font-normal text-text-dim ml-1">/ {fmtNum(g.target_value, 0)}{g.unit ? ` ${g.unit}` : ''}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-auto pt-2">
                    <div className="flex-1 h-1 rounded-full bg-bg-hover overflow-hidden">
                      <div className="h-full rounded-full progress-bar" style={{ width: `${r}%`, background: colorHex }} />
                    </div>
                    <span className="text-xs font-semibold tabular-nums" style={{ color: colorHex }}>{r}%</span>
                  </div>
                  {etaHint && (
                    <div className={`text-[10px] mt-1.5 tabular-nums ${etaHint.tone === 'good' ? 'text-accent' : etaHint.tone === 'bad' ? 'text-danger' : 'text-text-dim'}`}>
                      {etaHint.tone === 'good' ? '↗ ' : etaHint.tone === 'bad' ? '↘ ' : '→ '}{etaHint.text}
                    </div>
                  )}
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
      const top = [...dayTasks]
        .filter((t) => t.status === 'active' && !t.parent_id)
        .sort((a, b) => (a.priority - b.priority) || (a.start_time ?? '').localeCompare(b.start_time ?? ''))
        .slice(0, 3);
      const subtasksOf = (parentId: string) =>
        tasks.filter((t) => t.parent_id === parentId);
      return (
        <WidgetCard editing={editing} onHide={() => hideWidget('focus')}>
          <div className="flex flex-col h-full">
            <div className="text-[10px] uppercase tracking-widest text-text-muted font-medium mb-3">Фокус дня</div>
            {top.length === 0 ? (
              <div className="flex-1 flex items-center gap-3">
                <div className="h-10 w-10 shrink-0 rounded-full bg-accent/10 flex items-center justify-center">
                  <Target className="h-5 w-5 text-accent" />
                </div>
                <p className="text-base font-semibold leading-snug text-text">
                  Сегодня нет активных задач. Добавь главное.
                </p>
              </div>
            ) : (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {top.map((t, i) => {
                  const subs = subtasksOf(t.id);
                  const subsDone = subs.filter((s) => s.status === 'done').length;
                  return (
                    <div key={t.id} className="border border-border-soft p-3 flex flex-col gap-2 min-w-0">
                      <div className="flex items-start gap-2">
                        <span className="text-2xl font-bold text-text-dim leading-none w-6 tabular-nums">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-base font-semibold leading-snug truncate">{t.title}</div>
                          <div className="text-[11px] text-text-muted flex gap-2 mt-0.5">
                            {t.start_time && <span className="tabular-nums">{t.start_time}</span>}
                            {subs.length > 0 && <span>{subsDone}/{subs.length} подзадач</span>}
                          </div>
                        </div>
                        <span onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={false} onCheckedChange={() => toggleTask(t.id)} />
                        </span>
                      </div>
                      {subs.length > 0 && (
                        <ul className="ml-8 space-y-1">
                          {subs.slice(0, 3).map((s) => (
                            <li key={s.id} className="flex items-center gap-2 text-xs">
                              <span onClick={(e) => e.stopPropagation()}>
                                <Checkbox checked={s.status === 'done'} onCheckedChange={() => toggleTask(s.id)} />
                              </span>
                              <span className={s.status === 'done' ? 'line-through text-text-muted' : 'text-text-muted'}>{s.title}</span>
                            </li>
                          ))}
                          {subs.length > 3 && (
                            <li className="text-[11px] text-text-dim">+ ещё {subs.length - 3}</li>
                          )}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </WidgetCard>
      );
    },

    'quests': () => {
      const state = loadQuests(habits.map((h) => ({ id: h.id })));
      const ctx = { today, tasks, habits: habits.map((h) => ({ id: h.id, title: h.title })), habitLogs, reflections, timeEntries };
      const items = state.keys.map((k) => QUEST_POOL.find((q) => q.key === k)).filter(Boolean) as typeof QUEST_POOL;
      // award on completion
      items.forEach((q) => {
        if (state.rewardedKeys.includes(q.key)) return;
        const tgt = effectiveTarget(q, ctx);
        if (q.measure(ctx) >= tgt) {
          state.rewardedKeys.push(q.key);
          saveQuests(state);
          queueMicrotask(() => awardXp('task', q.key));
        }
      });
      // all-day bonus tracker
      if (state.rewardedKeys.length === items.length && items.length > 0) {
        const flagKey = `quests.all_day_done.${state.date}`;
        if (localStorage.getItem(flagKey) !== '1') {
          localStorage.setItem(flagKey, '1');
          const prev = Number(localStorage.getItem('quests.all_day_count.v1') || 0);
          localStorage.setItem('quests.all_day_count.v1', String(prev + 1));
          try {
            import('@/lib/inbox').then((m) => m.useInbox.getState().add({
              kind: 'daily_quest_full',
              title: 'Полный сбор!',
              body: 'Все 3 daily quests закрыты сегодня',
              link: '/awards',
            }));
          } catch {}
        }
      }
      return (
        <WidgetCard editing={editing} onHide={() => hideWidget('quests')}>
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="mb-0">Задания дня</CardTitle>
            <span className="text-[11px] text-text-muted tabular-nums">
              {state.rewardedKeys.length}/{items.length}
            </span>
          </div>
          <div className="space-y-3">
            {items.map((q) => {
              const tgt = effectiveTarget(q, ctx);
              const cur = Math.min(tgt, q.measure(ctx));
              const done = cur >= tgt;
              const pct = Math.round((cur / tgt) * 100);
              return (
                <div key={q.key}>
                  <div className="flex justify-between text-sm">
                    <span className={done ? 'text-accent' : 'text-text'}>{done ? '✓ ' : ''}{q.title}</span>
                    <span className="text-text-muted tabular-nums text-xs">{cur}/{tgt} · +{q.reward}XP</span>
                  </div>
                  <Progress value={pct} className="mt-1.5" barColor={done ? '#22c55e' : undefined} />
                </div>
              );
            })}
          </div>
        </WidgetCard>
      );
    },

    'letter': () => {
      const streak = computeStreak(new Date(), tasks, habitLogs, reflections);
      const dailyGoal = Number(localStorage.getItem('gamification.dailyGoal')) || 100;
      const lvl = levelFromXp(xpTotal(xpLog)).level;
      const xt = xpToday(today, xpLog);
      const ctx = {
        today, streak, level: lvl, xpToday: xt, dailyGoal,
        tasks, habitLogs, reflections, timeEntries, xpLog,
      };
      // Choose once per day; persist key in localStorage so it stays stable
      const cacheKey = `thedad.letter.key.${today}`;
      let letter = pickLetter(ctx);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const match = letter && letter.key === cached ? letter : null;
        letter = match ?? letter;
      }
      if (letter && lastShownDate() !== today) {
        localStorage.setItem(cacheKey, letter.key);
        markShown();
      }
      // Редизайн: спокойный «конверт» на мягкой подложке, тон письма — точка-индикатор
      const out = letter?.render(ctx);
      const tone = out?.tone ?? 'neutral';
      const toneDot = tone === 'urgent' ? 'var(--danger, #ef4444)'
                    : tone === 'celebrate' ? 'var(--accent)'
                    : tone === 'warm' ? '#38bdf8'
                    : 'var(--text-dim)';
      const toneLabel = tone === 'urgent' ? 'важно' : tone === 'celebrate' ? 'праздник' : tone === 'warm' ? 'поддержка' : 'на сегодня';
      return (
        <WidgetCard title="Письмо от маскота" editing={editing} onHide={() => hideWidget('letter')}>
          <div className="h-full rounded-xl bg-bg-soft/60 border border-border-soft p-3 flex gap-3 items-start">
            <div className="shrink-0 h-14 w-14 rounded-xl bg-bg-card border border-border-soft flex items-center justify-center overflow-hidden">
              <Mascot streak={streak} size={44} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ background: toneDot }} />
                <span className="text-[10px] uppercase tracking-wider text-text-dim">{toneLabel}</span>
              </div>
              <div className="text-sm font-semibold text-text mt-1 leading-snug">
                {out?.title ?? 'Всё идёт ровно'}
              </div>
              <p className="text-xs text-text-muted leading-relaxed mt-1">
                {out?.body ?? 'Сегодня без замечаний. Продолжай в том же духе — серия работает на тебя.'}
              </p>
            </div>
          </div>
        </WidgetCard>
      );
    },

    'leagues': () => {
      const weekXp = xpInWeek(xpLog, new Date());
      const cur = leagueFor(weekXp);
      // record league peak
      try {
        const peakRaw = localStorage.getItem('leagues.peak.v1');
        const peak = peakRaw ? Number(peakRaw) : 0;
        const idx = ['bronze', 'silver', 'gold', 'sapphire', 'ruby', 'diamond'].indexOf(cur.key);
        if (idx > peak) localStorage.setItem('leagues.peak.v1', String(idx));
      } catch {}
      const next = nextLeague(weekXp);
      const span = next ? next.minXp - cur.minXp : 1;
      const within = next ? weekXp - cur.minXp : 1;
      const pct = next ? Math.round((within / span) * 100) : 100;
      const history = buildHistory(xpLog, 8);
      return (
        // Редизайн: плашка лиги на мягкой подложке цвета лиги, скруглённая история недель
        <WidgetCard title="Лига недели" editing={editing} onHide={() => hideWidget('leagues')}>
          <div className="flex flex-col h-full">
            <div className="flex items-center gap-4 mb-3">
              <div
                className="rounded-xl px-3.5 py-2 text-sm font-bold shrink-0 flex items-center gap-1.5"
                style={{ background: `${cur.color}1c`, color: cur.color }}
              >
                <Medal className="h-4 w-4" /> {cur.label}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-1.5 gap-2">
                  <span className="text-text-muted tabular-nums truncate">{weekXp} XP за неделю</span>
                  {next ? <span className="text-text-dim tabular-nums shrink-0">до {next.label}: {next.minXp - weekXp} XP</span>
                        : <span className="text-accent shrink-0">высшая лига</span>}
                </div>
                <Progress value={pct} barColor={cur.color} />
              </div>
            </div>
            <div className="flex gap-1.5 mt-auto items-end">
              {history.map((h, i) => (
                <div key={i} className="flex-1 text-center min-w-0" title={`${h.weekStart} · ${h.xp} XP · ${h.league.label}`}>
                  <div
                    className="rounded-md transition-[height]"
                    style={{
                      height: `${12 + Math.min(1, h.xp / 2000) * 20}px`,
                      background: h.league.color,
                      opacity: 0.35 + Math.min(1, h.xp / 2000) * 0.65,
                    }}
                  />
                  <div className="text-[9px] text-text-dim mt-1 tabular-nums truncate">{h.weekStart.slice(5)}</div>
                </div>
              ))}
            </div>
          </div>
        </WidgetCard>
      );
    },

    'weekly-challenge': () => {
      const state = loadWeekly();
      const def = WEEKLY_POOL.find((w) => w.key === state.key);
      if (!def) return <WidgetCard editing={editing} onHide={() => hideWidget('weekly-challenge')}>—</WidgetCard>;
      const ctx = buildWeeklyCtx(new Date(), tasks, habitLogs, reflections, timeEntries);
      const cur = Math.min(def.target, def.measure(ctx));
      const pct = Math.round((cur / def.target) * 100);
      const done = cur >= def.target;
      if (done && !state.rewarded) {
        state.rewarded = true;
        saveWeekly(state);
        try {
          const prev = Number(localStorage.getItem('weekly.wins.v1') || 0);
          localStorage.setItem('weekly.wins.v1', String(prev + 1));
        } catch {}
        try {
          import('@/lib/inbox').then((m) => m.useInbox.getState().add({
            kind: 'weekly_win',
            title: `Челлендж недели: ${def.title}`,
            body: `Награда: +${def.reward} XP`,
            link: '/awards',
          }));
        } catch {}
        queueMicrotask(() => awardXp('progress', def.key));
      }
      return (
        <WidgetCard editing={editing} onHide={() => hideWidget('weekly-challenge')}>
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between mb-2">
              <CardTitle className="mb-0">Челлендж недели</CardTitle>
              <span className="text-[11px] text-accent">+{def.reward} XP</span>
            </div>
            <div className="flex-1 flex flex-col justify-center">
              <div className="text-xl font-bold leading-tight">{def.title}</div>
              <div className="text-xs text-text-muted">{def.description}</div>
              <div className="mt-3 flex items-center gap-3">
                <Progress value={pct} className="flex-1 h-2" barColor={done ? '#22c55e' : undefined} />
                <span className="text-sm font-semibold tabular-nums">{cur}/{def.target}</span>
              </div>
              {done && <div className="mt-2 text-xs text-accent">✓ Челлендж пройден!</div>}
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
  });

  const widgets = buildWidgets(editing);
  // Превью для окна выбора: без редакторской хромки и с отключёнными кликами
  const previewWidgets = buildWidgets(false);
  const renderWidgetPreview = (id: string): React.ReactNode => {
    if (id.startsWith('plugin:')) {
      const p = plugins.find((x) => `plugin:${x.id}` === id);
      return p ? <PluginWidget def={p} /> : null;
    }
    return previewWidgets[id]?.();
  };

  // Пустой старт — иллюстрированный экран «с чего начать» вместо пустой drag-сетки
  if (goals.length === 0 && tasks.length === 0 && habits.length === 0 && reflections.length === 0) {
    return <EmptyDashboard date={date} />;
  }

  return (
    <div className="page py-4 sm:py-6">
      {/* Main area */}
      <div className="min-w-0">
        <div>
          {/* Шапка: приветствие + дата · цитата дня вписана в фон + редактор */}
          <div className="mb-6 px-1 flex items-start justify-between gap-8">
            <div className="min-w-0">
              {/* Мобайл: меньше кегль и перенос вместо обрезания имени */}
              <h1 className="text-2xl sm:text-h1 text-text flex items-center flex-wrap gap-x-3 gap-y-1">
                <span className="break-words">{greeting()}, {getUserName()}.</span> <WeatherChip />
              </h1>
              <div className="text-sm text-text-muted mt-1">
                <span className="capitalize">{format(date, 'EEEE, d MMMM', { locale: ru })}</span>
                <span className="text-text-dim"> · ты на <span className="text-accent font-medium">{weekDoneRatio}%</span> ближе к целям недели</span>
              </div>
            </div>
            <div className="hidden lg:flex items-start gap-2 pt-2 shrink min-w-0 max-w-md">
              <div className="text-[13px] text-text-dim leading-snug text-right italic min-w-0">
                «{quote.text}» <span className="not-italic whitespace-nowrap">— {quote.author}</span>
              </div>
              <Button
                variant={editing ? 'default' : 'ghost'}
                size="icon"
                onClick={() => (editing ? exitEditor() : enterEditor())}
                title={editing ? 'Готово' : 'Редактор раскладки'}
                className="shrink-0 -mt-1.5 text-text-dim"
              >
                {editing ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Дашборд на всю ширину — правый рейл убран, всё живёт в виджетах */}
          <div>
            <div ref={gridRef} className="min-w-0 w-full">
          {editing && (
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="text-sm text-text-muted">
              Перетаскивай и меняй размер. Нажми «Готово» чтобы сохранить.
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
                  <Button variant="ghost" size="sm" onClick={resetLayout}>
                    <RotateCcw className="h-3.5 w-3.5" /> Сбросить
                  </Button>
                  {backup && (
                    <Button variant="ghost" size="sm" onClick={revertToBackup} title="Откатить к моменту входа в редактор">
                      <RotateCcw className="h-3.5 w-3.5" /> Отменить правки
                    </Button>
                  )}
                </>
              )}
              <Button variant="default" size="sm" onClick={exitEditor}>
                <Unlock className="h-3.5 w-3.5" /> Готово
              </Button>
            </div>
          </div>
          )}

          {gridW > 0 && (
          <Responsive
            width={gridW}
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
              <div key={l.i} className="bento-item group/bento relative">
                {l.i.startsWith('plugin:') ? (
                  <Cell editing={editing} onHide={() => hideWidget(l.i)}>
                    {(() => {
                      const p = plugins.find((x) => `plugin:${x.id}` === l.i);
                      return p ? <PluginWidget def={p} /> : null;
                    })()}
                  </Cell>
                ) : widgets[l.i]?.()}
                {!editing && WIDGET_PAGE[l.i] && (
                  <button
                    onClick={() => openPage(WIDGET_PAGE[l.i])}
                    className="absolute bottom-2 right-2 z-20 h-7 w-7 rounded-lg bg-bg-soft/85 backdrop-blur text-text-muted hover:text-text hover:bg-bg-hover flex items-center justify-center opacity-0 group-hover/bento:opacity-100 transition-opacity"
                    title="Развернуть в страницу"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </Responsive>
          )}

          {/* Плитка «+» в конце сетки: квадратный виджет-призрак, как обычная ячейка */}
          {editing && (
            <button
              onClick={() => setPickerOpen(true)}
              className="mt-[10px] w-full sm:w-[240px] h-[240px] rounded-xl border-2 border-dashed border-accent/35 hover:border-accent/70 bg-accent/[0.04] hover:bg-accent/10 flex flex-col items-center justify-center gap-2 text-text-muted hover:text-accent transition-colors"
              title="Добавить виджет"
            >
              <Plus className="h-12 w-12" strokeWidth={1.25} />
              <span className="text-sm font-medium">Добавить виджет</span>
              {availableWidgets.length > 0 && (
                <span className="text-xs text-text-dim">{availableWidgets.length} доступно</span>
              )}
            </button>
          )}
            </div>
          </div>
        </div>
      </div>

      <WidgetPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        available={availableWidgets}
        onAdd={addWidget}
        renderPreview={renderWidgetPreview}
      />

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
  // bg-bg-card классом (не inline) — чтобы glass-темы навешивали backdrop-blur.
  // Фон у всех виджетов одинаковый: без акцентных карточек.
  <div
    className={`relative h-full flex flex-col overflow-hidden rounded-xl transition-all duration-200 ${editing ? '' : 'bg-bg-card'} ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    style={editing ? {
      border: '1px dashed var(--accent)',
      background: 'var(--accent-glow)',
      padding: '16px',
    } : {
      border: '1px solid var(--border-soft)',
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.05)',
      padding: '16px',
    }}
    onClick={onClick}
  >
    {title && (
      <div className="section-label shrink-0">{title}</div>
    )}
    <div className="flex-1 min-h-0">{children}</div>
    {editing && onHide && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onHide(); }}
        className="absolute top-1 right-1 p-1 text-text-dim hover:text-danger z-10"
        title="Скрыть"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    )}
  </div>
);

// Тонкая обёртка для виджетов, рендерящих собственную карточку:
// добавляет только редакторскую хромку и растягивает ребёнка на всю ячейку сетки.
const Cell: React.FC<{ editing: boolean; onHide?: () => void; children: React.ReactNode }> = ({ editing, onHide, children }) => (
  <div className="relative h-full">
    <div className="h-full [&>*]:h-full">{children}</div>
    {editing && onHide && (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onHide(); }}
        className="absolute top-1 right-1 p-1 text-text-dim hover:text-danger z-10"
        title="Скрыть"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    )}
  </div>
);
