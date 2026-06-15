import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { useStore } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { QuickAddDialog } from './components/QuickAddDialog';
import { CommandPalette } from './components/CommandPalette';
import { PomodoroTimer } from './components/PomodoroTimer';
import { Confetti } from './components/Confetti';
import { applyAccent, getAccent } from './lib/theme';
import { useNavigate } from 'react-router-dom';
import { loadReminders, scheduleHeartbeat } from './lib/notifications';

const GoalsPage = lazy(() => import('./pages/Goals').then((m) => ({ default: m.GoalsPage })));
const TasksPage = lazy(() => import('./pages/Tasks').then((m) => ({ default: m.TasksPage })));
const HabitsPage = lazy(() => import('./pages/Habits').then((m) => ({ default: m.HabitsPage })));
const PlanPage = lazy(() => import('./pages/Plan').then((m) => ({ default: m.PlanPage })));
const AnalyticsPage = lazy(() => import('./pages/Analytics').then((m) => ({ default: m.AnalyticsPage })));
const ReflectionPage = lazy(() => import('./pages/Reflection').then((m) => ({ default: m.ReflectionPage })));
const HistoryPage = lazy(() => import('./pages/History').then((m) => ({ default: m.HistoryPage })));
const SettingsPage = lazy(() => import('./pages/Settings').then((m) => ({ default: m.SettingsPage })));
const AwardsPage = lazy(() => import('./pages/Awards').then((m) => ({ default: m.AwardsPage })));

const Loader = () => (
  <div className="h-full flex items-center justify-center text-text-muted text-sm">Загрузка...</div>
);

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [date, setDate] = useState(new Date());
  const [range, setRange] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | 'goal' | 'progress' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const nav = useNavigate();
  const bellCount = loadReminders().filter((r) => r.enabled).length;
  const recentUnlocks = useStore((s) => s.recentUnlocks);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  useEffect(() => {
    if (recentUnlocks.length > 0) setConfettiTrigger((v) => v + 1);
  }, [recentUnlocks.length]);

  useEffect(() => { void init(); applyAccent(getAccent()); }, [init]);

  useEffect(() => {
    if (!ready) return;
    scheduleHeartbeat({
      morningBody: () => {
        const st = useStore.getState();
        const today = new Date().toISOString().slice(0, 10);
        const top = st.tasks
          .filter((t) => t.date === today && t.status === 'active' && !t.parent_id)
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 3)
          .map((t) => `• ${t.title}`).join('\n');
        return top ? `Главное на сегодня:\n${top}` : 'Утро. Что главное сегодня?';
      },
      eveningBody: () => {
        const st = useStore.getState();
        const today = new Date().toISOString().slice(0, 10);
        const has = st.reflections.some((r) => r.date === today && r.mood !== null);
        if (has) return 'Хороший день. Завтра тоже получится.';
        const dt = st.tasks.filter((t) => t.date === today);
        const done = dt.filter((t) => t.status === 'done').length;
        return `Закрой день: ${done}/${dt.length} задач. Запиши рефлексию.`;
      },
    });
  }, [ready]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  if (!ready) {
    return (
      <div className="h-full flex items-center justify-center text-text-muted text-sm">
        Загрузка SQLite...
      </div>
    );
  }

  return (
    <div className="h-full flex bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          date={date} onDate={setDate} range={range} onRange={setRange}
          onAdd={() => setQuickTab('task')}
          onTimer={() => setTimerOpen(true)}
          onBell={() => nav('/settings#reminders')}
          bellCount={bellCount}
        />
        <main className="flex-1 overflow-auto pb-16 sm:pb-0">
          <Suspense fallback={<Loader />}>
            <Routes>
              <Route path="/index.html" element={<Navigate to="/" replace />} />
              <Route path="/" element={<Dashboard date={date} />} />
              <Route path="/goals" element={<GoalsPage />} />
              <Route path="/tasks" element={<TasksPage date={date} />} />
              <Route path="/habits" element={<HabitsPage />} />
              <Route path="/plan" element={<PlanPage date={date} />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/reflection" element={<ReflectionPage date={date} />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/awards" element={<AwardsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </Suspense>
        </main>
      </div>
      <QuickAddDialog
        open={quickTab !== null}
        onOpenChange={(v) => !v && setQuickTab(null)}
        date={date}
        initialTab={quickTab ?? undefined}
      />
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onAddTask={() => setQuickTab('task')}
        onAddHabit={() => setQuickTab('habit')}
        onAddGoal={() => setQuickTab('goal')}
        onAddProgress={() => setQuickTab('progress')}
      />
      <PomodoroTimer task={null} open={timerOpen} onClose={() => setTimerOpen(false)} />
      <Confetti trigger={confettiTrigger} />
    </div>
  );
}
