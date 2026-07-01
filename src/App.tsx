import { lazy, Suspense, useEffect, useState } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { useStore } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { QuickAddDialog } from './components/QuickAddDialog';
import { CommandPalette } from './components/CommandPalette';
import { PomodoroTimer } from './components/PomodoroTimer';
import { Confetti } from './components/Confetti';
import { FocusMode } from './components/FocusMode';
import { Onboarding } from './components/Onboarding';
import { isOnboardingDone } from './lib/onboarding';
import { InboxPopover } from './components/InboxPopover';
import { InsightsPanel } from './components/InsightsPanel';
import { Toaster } from './components/Toaster';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { useInbox } from './lib/inbox';
import { ACHIEVEMENTS } from './lib/gamification';
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
const TemplatesPage = lazy(() => import('./pages/Templates').then((m) => ({ default: m.TemplatesPage })));
const CalendarPage = lazy(() => import('./pages/Calendar').then((m) => ({ default: m.CalendarPage })));

const Loader = () => (
  <div className="p-6 space-y-6">
    <div className="skeleton h-8 w-48" />
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-40 rounded-2xl" />
      <div className="skeleton h-40 rounded-2xl" />
    </div>
    <div className="skeleton h-64 w-full rounded-2xl" />
  </div>
);

export default function App() {
  const ready = useStore((s) => s.ready);
  const init = useStore((s) => s.init);
  const [date, setDate] = useState(new Date());
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | 'goal' | 'progress' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [timerOpen, setTimerOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => { if (ready && !isOnboardingDone()) setOnboardOpen(true); }, [ready]);

  const nav = useNavigate();
  const location = useLocation();
  const bellCount = loadReminders().filter((r) => r.enabled).length;
  const recentUnlocks = useStore((s) => s.recentUnlocks);
  const inboxUnread = useInbox((s) => s.items.filter((x) => !x.read).length);
  const addInbox = useInbox((s) => s.add);
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  useEffect(() => {
    if (recentUnlocks.length > 0) setConfettiTrigger((v) => v + 1);
    recentUnlocks.forEach((u) => {
      const a = ACHIEVEMENTS.find((x) => x.key === u.key);
      if (a) addInbox({ kind: 'achievement', title: `Награда «${a.title}»`, body: a.description, icon: a.icon, link: '/awards' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFocusOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setInsightsOpen((v) => !v);
      }
      // "?" без модификаторов и не в поле ввода
      if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement;
        const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
        if (!typing) {
          e.preventDefault();
          setShortcutsOpen((v) => !v);
        }
      }
    };
    const onQuick = () => setQuickTab('task');
    const onFocus = () => setFocusOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('thedad:quick-capture', onQuick);
    window.addEventListener('thedad:focus-mode', onFocus);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('thedad:quick-capture', onQuick);
      window.removeEventListener('thedad:focus-mode', onFocus);
    };
  }, []);

  if (!ready) {
    return (
      <div className="h-full flex bg-bg">
        {/* Sidebar skeleton */}
        <div className="hidden sm:flex w-[210px] shrink-0 border-r border-border flex-col p-5 gap-3">
          <div className="flex items-center gap-3">
            <div className="skeleton h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <div className="skeleton h-3 w-20" />
              <div className="skeleton h-2 w-16" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-8 w-full rounded-lg" />)}
          </div>
        </div>
        {/* Main skeleton */}
        <div className="flex-1 flex flex-col">
          <div className="h-20 border-b border-border px-8 flex items-center">
            <div className="space-y-2">
              <div className="skeleton h-6 w-64" />
              <div className="skeleton h-3 w-40" />
            </div>
          </div>
          <div className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
            <div className="space-y-6">
              <div className="skeleton h-44 w-full rounded-2xl" />
              <div className="skeleton h-72 w-full rounded-2xl" />
              <div className="grid grid-cols-3 gap-6">
                <div className="skeleton h-40 rounded-2xl" />
                <div className="skeleton h-40 rounded-2xl" />
                <div className="skeleton h-40 rounded-2xl" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="skeleton h-64 rounded-2xl" />
              <div className="skeleton h-48 rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onAdd={() => setQuickTab('task')}
          onAddNote={() => setQuickTab('task')}
          onAddGoal={() => setQuickTab('goal')}
          onTimer={() => setTimerOpen(true)}
          onFocusMode={() => setFocusOpen(true)}
          onInsights={() => setInsightsOpen((v) => !v)}
          onBell={() => setInboxOpen((v) => !v)}
          onPalette={() => setPaletteOpen(true)}
          bellCount={inboxUnread || bellCount}
        />
        <main className="flex-1 overflow-auto pb-16 sm:pb-0">
          <div key={location.pathname} className="animate-fade-in h-full">
            <Suspense fallback={<Loader />}>
              <Routes location={location}>
                <Route path="/index.html" element={<Navigate to="/" replace />} />
                <Route path="/" element={<Dashboard date={date} onStartFocus={() => setFocusOpen(true)} />} />
                <Route path="/dashboard-bento" element={<Navigate to="/" replace />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/tasks" element={<TasksPage date={date} />} />
                <Route path="/habits" element={<HabitsPage />} />
                <Route path="/plan" element={<PlanPage date={date} />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/reflection" element={<ReflectionPage date={date} />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/awards" element={<AwardsPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
          </div>
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
        onFocusMode={() => setFocusOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <PomodoroTimer task={null} open={timerOpen} onClose={() => setTimerOpen(false)} />
      <FocusMode open={focusOpen} onClose={() => setFocusOpen(false)} />
      <Onboarding open={onboardOpen} onClose={() => setOnboardOpen(false)} />
      <InboxPopover open={inboxOpen} onClose={() => setInboxOpen(false)} />
      <InsightsPanel open={insightsOpen} onClose={() => setInsightsOpen(false)} />
      <Confetti trigger={confettiTrigger} />
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster />
    </div>
  );
}
