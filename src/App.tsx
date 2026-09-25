import { lazy, Suspense, useEffect, useState } from 'react';
import { todayISO } from './lib/utils';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { useStore } from './lib/store';
import { Dashboard } from './pages/Dashboard';
import { QuickAddDialog } from './components/QuickAddDialog';
import { CommandPalette } from './components/CommandPalette';
import { WidgetExpandModal } from './components/WidgetExpandModal';
import { Confetti } from './components/Confetti';
import { Onboarding } from './components/Onboarding';
import { isOnboardingDone } from './lib/onboarding';
import { focusShouldResume } from './lib/focusSession';
import { InboxPopover } from './components/InboxPopover';
import { Toaster } from './components/Toaster';
import { ShortcutsHelp } from './components/ShortcutsHelp';
import { useInbox } from './lib/inbox';
import { ACHIEVEMENTS } from './lib/gamification';
import { applyAccent, getAccent } from './lib/theme';
import { useNavigate } from 'react-router-dom';
import { loadReminders, scheduleHeartbeat } from './lib/notifications';
import { useHealthSync } from './lib/healthSync';
import { AppLiveWallpaper } from './components/AppLiveWallpaper';
import { Celebration } from './components/Celebration';
import { MiniPlayer } from './components/MiniPlayer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { lazyNamed, MountOnce } from './components/lazy';
import { FEATURE_PLUS } from './lib/features';

// Окна, которые открываются по требованию, грузятся при первом открытии —
// вместе ~2100 строк кода, которые раньше шли до первой отрисовки у всех.
const FocusMode = lazyNamed(() => import('./components/FocusMode').then((m) => m.FocusMode));
const AiGenerateModal = lazyNamed(() => import('./components/AiGenerateModal').then((m) => m.AiGenerateModal));
const MarketplaceModal = lazyNamed(() => import('./components/marketplace/MarketplaceModal').then((m) => m.MarketplaceModal));
const ProgramRunner = lazyNamed(() => import('./components/marketplace/ProgramRunner').then((m) => m.ProgramRunner));
const WeeklyReview = lazyNamed(() => import('./components/WeeklyReview').then((m) => m.WeeklyReview));
const WorkoutHub = lazyNamed(() => import('./components/marketplace/WorkoutHub').then((m) => m.WorkoutHub));
import { MARKETPLACE_EVENT, PROGRAM_OPEN_EVENT, PROGRAM_HUB_EVENT } from './lib/marketplace';

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
const HealthPage = lazy(() => import('./pages/Health').then((m) => ({ default: m.HealthPage })));
const LandingPage = lazy(() => import('./pages/Landing').then((m) => ({ default: m.LandingPage })));

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
  const initError = useStore((s) => s.initError);
  const [date, setDate] = useState(new Date());
  const [quickTab, setQuickTab] = useState<'task' | 'habit' | 'goal' | 'progress' | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusTaskId, setFocusTaskId] = useState<string | null>(null);
  const [expandPage, setExpandPage] = useState<string | null>(null);
  const [onboardOpen, setOnboardOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  // Вкладка панели уведомлений: колокол → уведомления, Ctrl+I / лампочка → инсайты
  const [inboxTab, setInboxTab] = useState<'inbox' | 'insights'>('inbox');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aiGenOpen, setAiGenOpen] = useState(false);
  const [marketOpen, setMarketOpen] = useState(false);
  const [programId, setProgramId] = useState<string | null>(null);
  const [hubId, setHubId] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  useEffect(() => { if (ready && !isOnboardingDone()) setOnboardOpen(true); }, [ready]);
  // Фокус-сессия ещё идёт (перезагрузили страницу / открыли в новой вкладке) — продолжаем с того же места
  useEffect(() => { if (ready && focusShouldResume()) setFocusOpen(true); }, [ready]);

  // Единая точка синхронизации: питание/зарядка/активность → healthLogs → цели
  useHealthSync();

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

  useEffect(() => {
    // QR-привязка: если открыли ссылку с #sync=, подтягиваем БД и перезагружаемся
    (async () => {
      try {
        const m = await import('./lib/sync');
        if (await m.importSyncFromHashIfPresent()) { window.location.reload(); return; }
      } catch {}
      void init();
    })();
    applyAccent(getAccent());
    // Предустановленные виджеты-плагины (например, «Правильное питание на месяц»)
    void import('./lib/plugins').then((m) => m.ensureDefaultPlugins());
  }, [init]);

  // Plus: фоновая синхронизация, и после слияния — перечитать стор, чтобы
  // пришедшее с других устройств сразу появилось на экране.
  useEffect(() => {
    if (!ready || !FEATURE_PLUS) return;
    let stop = () => {};
    const onMerged = () => useStore.getState().reload();
    void import('./lib/sync').then((m) => {
      window.addEventListener(m.SYNC_MERGED_EVENT, onMerged);
      stop = m.startAutoSync();
    });
    return () => { stop(); window.removeEventListener('thedad-sync-merged', onMerged); };
  }, [ready]);

  // Быстрый ввод снаружи приложения: глобальная клавиша десктопа и «td …»
  // в адресной строке расширения.
  useEffect(() => {
    if (!ready) return;
    let stop = () => {};
    void import('./lib/desktop').then((m) => { stop = m.bindDesktopQuickCapture(); });
    const pull = () => void import('./lib/extension').then(async (m) => {
      const items = await m.drainExtensionInbox();
      const today = todayISO();
      for (const it of items) useStore.getState().addTask({ title: it.title, date: today });
      if (items.length) {
        const { toast } = await import('./lib/toast');
        toast.success(items.length === 1 ? 'Задача из адресной строки добавлена' : `Добавлено задач из адресной строки: ${items.length}`, items.map((i) => i.title).join(', '));
      }
    });
    pull();
    let unsub = () => {};
    void import('./lib/extension').then((m) => { unsub = m.onExtensionInbox(pull); });
    return () => { stop(); unsub(); };
  }, [ready]);

  // Недельный обзор: ссылка /review (из уведомления) открывает окно, а в
  // воскресенье, если обзор ещё не пройден, — приглашение в уведомлениях.
  useEffect(() => {
    if (location.pathname !== '/review') return;
    setReviewOpen(true);
    nav('/', { replace: true });
  }, [location.pathname, nav]);
  useEffect(() => {
    if (!ready) return;
    void import('./lib/weeklyReview').then(({ reviewDue }) => {
      if (!reviewDue()) return;
      const key = 'thedad.weekly-review.invited';
      const today = todayISO();
      if (localStorage.getItem(key) === today) return;
      localStorage.setItem(key, today);
      addInbox({ kind: 'weekly_win', title: 'Время обзора недели', body: 'Пять минут: что сдвинулось по целям, что перенести, что главное дальше.', icon: '🗓️', link: '/review' });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  // «Не успеваете»: при запуске и после каждой отметки прогресса. Не чаще раза
  // в неделю на цель — это следит duePaceAlerts.
  const progressCount = useStore((s) => s.progress.length);
  useEffect(() => {
    if (!ready) return;
    const { goals, progress } = useStore.getState();
    void import('./lib/paceAlert').then(({ duePaceAlerts, paceMessage }) => {
      for (const v of duePaceAlerts(goals, progress)) {
        const { title, body } = paceMessage(v);
        addInbox({ kind: 'pace', title, body, link: '/goals' });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, progressCount]);

  useEffect(() => {
    if (!ready) return;
    scheduleHeartbeat({
      morningBody: () => {
        const st = useStore.getState();
        const today = todayISO();
        const top = st.tasks
          .filter((t) => t.date === today && t.status === 'active' && !t.parent_id)
          .sort((a, b) => a.priority - b.priority)
          .slice(0, 3)
          .map((t) => `• ${t.title}`).join('\n');
        return top ? `Главное на сегодня:\n${top}` : 'Утро. Что главное сегодня?';
      },
      eveningBody: () => {
        const st = useStore.getState();
        const today = todayISO();
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
        setInboxTab('insights');
        setInboxOpen((v) => !v);
      }
      // Одиночные клавиши без модификаторов и не в поле ввода
      if (!e.metaKey && !e.ctrlKey && !e.altKey) {
        const el = document.activeElement;
        const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);
        if (!typing) {
          // e.code — независимо от раскладки (T работает и на «е»)
          if (e.key === '?') { e.preventDefault(); setShortcutsOpen((v) => !v); }
          else if (e.code === 'KeyT') { e.preventDefault(); setQuickTab('task'); }
          else if (e.code === 'KeyN') { e.preventDefault(); setQuickTab('task'); }
          else if (e.code === 'KeyF') { e.preventDefault(); setFocusOpen(true); }
          else if (e.code === 'KeyG') { e.preventDefault(); setQuickTab('goal'); }
          else if (e.code === 'KeyQ') { e.preventDefault(); setQuickTab('task'); }
        }
      }
    };
    const onQuick = () => setQuickTab('task');
    const onFocus = (e: Event) => {
      const id = (e as CustomEvent<{ taskId?: string }>).detail?.taskId ?? null;
      setFocusTaskId(id);
      setFocusOpen(true);
    };
    const onExpand = (e: Event) => {
      const page = (e as CustomEvent<{ page?: string }>).detail?.page ?? null;
      setExpandPage(page);
    };
    // Праздничный отклик (конфетти) — зарядка/еда/достижения дают всплеск, как в Duolingo
    const onCelebrate = () => setConfettiTrigger((v) => v + 1);
    const onAiGenerate = () => setAiGenOpen(true);
    const onMarket = () => setMarketOpen(true);
    const onReview = () => setReviewOpen(true);
    const onProgram = (e: Event) => setProgramId((e as CustomEvent<{ id?: string }>).detail?.id ?? null);
    const onHub = (e: Event) => setHubId((e as CustomEvent<{ id?: string }>).detail?.id ?? null);
    // Открыть палитру поиска из любого места (в т.ч. из Focus Mode — палитра поверх него)
    const onSearch = (e: Event) => { setPaletteQuery((e as CustomEvent<{ query?: string }>).detail?.query ?? ''); setPaletteOpen(true); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('thedad:search', onSearch);
    window.addEventListener('thedad:quick-capture', onQuick);
    window.addEventListener('thedad:focus-mode', onFocus);
    window.addEventListener('thedad:expand', onExpand);
    window.addEventListener('thedad:celebrate', onCelebrate);
    window.addEventListener('thedad:ai-generate', onAiGenerate);
    window.addEventListener(MARKETPLACE_EVENT, onMarket);
    window.addEventListener('thedad:weekly-review', onReview);
    window.addEventListener(PROGRAM_OPEN_EVENT, onProgram);
    window.addEventListener(PROGRAM_HUB_EVENT, onHub);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('thedad:search', onSearch);
      window.removeEventListener('thedad:quick-capture', onQuick);
      window.removeEventListener('thedad:focus-mode', onFocus);
      window.removeEventListener('thedad:expand', onExpand);
      window.removeEventListener('thedad:celebrate', onCelebrate);
      window.removeEventListener('thedad:ai-generate', onAiGenerate);
      window.removeEventListener(MARKETPLACE_EVENT, onMarket);
      window.removeEventListener('thedad:weekly-review', onReview);
      window.removeEventListener(PROGRAM_OPEN_EVENT, onProgram);
      window.removeEventListener(PROGRAM_HUB_EVENT, onHub);
    };
  }, []);

  // БД не открылась (чаще всего — создана более новой версией). Данные целы,
  // но работать с ними этой сборкой нельзя: показываем это явно, а не пустой экран.
  if (initError) {
    return (
      <div className="h-full flex items-center justify-center bg-bg p-6">
        <div className="max-w-md space-y-4 text-center">
          <div className="text-2xl font-semibold">Не удалось открыть базу данных</div>
          <div className="text-sm text-text-muted">{initError.message}</div>
          <div className="text-sm text-text-muted">
            Данные не пострадали. Обновите приложение до последней версии — после этого база откроется.
          </div>
          <button
            className="px-4 py-2 rounded-xl bg-accent text-white"
            onClick={() => window.location.reload()}
          >
            Перезагрузить
          </button>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="h-full flex flex-col bg-bg">
        {/* Topbar skeleton */}
        <div className="h-16 border-b border-border-soft px-6 flex items-center gap-3">
          <div className="skeleton h-8 w-8 rounded-lg" />
          <div className="skeleton h-9 w-24 rounded-lg" />
          <div className="skeleton h-10 flex-1 rounded-xl" />
          <div className="skeleton h-9 w-9 rounded-lg" />
        </div>
        {/* Main skeleton */}
        <div className="flex-1 p-6 space-y-6">
          <div className="skeleton h-10 w-72" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            <div className="skeleton h-44 rounded-2xl" />
            <div className="skeleton h-44 rounded-2xl" />
            <div className="skeleton h-44 rounded-2xl" />
            <div className="skeleton h-44 rounded-2xl" />
            <div className="skeleton h-44 rounded-2xl" />
            <div className="skeleton h-44 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  // Лендинг — вне оболочки приложения (без сайдбара/топбара)
  if (location.pathname === '/landing') {
    return (
      <Suspense fallback={<Loader />}>
        <LandingPage />
      </Suspense>
    );
  }

  return (
    <div className="h-full flex bg-bg">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          onAdd={() => setQuickTab('task')}
          onFocusMode={() => setFocusOpen(true)}
          onInsights={() => { setInboxTab('insights'); setInboxOpen(true); }}
          onBell={() => { setInboxTab('inbox'); setInboxOpen((v) => !v); }}
          onPalette={(query) => { setPaletteQuery(query ?? ''); setPaletteOpen(true); }}
          bellCount={inboxUnread || bellCount}
        />
        <main className="flex-1 overflow-auto pb-16 sm:pb-0">
          <div key={location.pathname} className="animate-[slide-up_240ms_cubic-bezier(0,0,0.2,1)] h-full">
            {/* Вложенная граница: падение одной страницы не должно уносить сайдбар и топбар,
                иначе пользователь не может уйти с неё даже мышью. Ключ по пути — сброс при навигации. */}
            <ErrorBoundary key={location.pathname}>
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
                <Route path="/health" element={<HealthPage date={date} />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </Suspense>
            </ErrorBoundary>
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
        onOpenChange={(v) => { setPaletteOpen(v); if (!v) setPaletteQuery(''); }}
        initialQuery={paletteQuery}
        onAddTask={() => setQuickTab('task')}
        onAddHabit={() => setQuickTab('habit')}
        onAddGoal={() => setQuickTab('goal')}
        onAddProgress={() => setQuickTab('progress')}
        onFocusMode={() => setFocusOpen(true)}
        onShortcuts={() => setShortcutsOpen(true)}
      />
      <WidgetExpandModal open={!!expandPage} onClose={() => setExpandPage(null)}>
        <Suspense fallback={<Loader />}>
          {expandPage === 'goals' && <GoalsPage />}
          {expandPage === 'tasks' && <TasksPage date={date} />}
          {expandPage === 'habits' && <HabitsPage />}
          {expandPage === 'plan' && <PlanPage date={date} />}
          {expandPage === 'analytics' && <AnalyticsPage />}
          {expandPage === 'reflection' && <ReflectionPage date={date} />}
          {expandPage === 'calendar' && <CalendarPage />}
          {expandPage === 'health' && <HealthPage date={date} />}
          {expandPage === 'awards' && <AwardsPage />}
          {expandPage === 'templates' && <TemplatesPage />}
          {expandPage === 'history' && <HistoryPage />}
          {expandPage === 'settings' && <SettingsPage />}
        </Suspense>
      </WidgetExpandModal>
      <MountOnce on={focusOpen}>
        <FocusMode open={focusOpen} initialTaskId={focusTaskId} onClose={() => { setFocusOpen(false); setFocusTaskId(null); }} />
      </MountOnce>
      <Onboarding open={onboardOpen} onClose={() => setOnboardOpen(false)} />
      <InboxPopover open={inboxOpen} onClose={() => setInboxOpen(false)} initialTab={inboxTab} />
      <Confetti trigger={confettiTrigger} />
      <Celebration />
      <AppLiveWallpaper suspended={focusOpen} />
      <MiniPlayer />
      <MountOnce on={aiGenOpen}><AiGenerateModal open={aiGenOpen} onOpenChange={setAiGenOpen} /></MountOnce>
      <MountOnce on={marketOpen}><MarketplaceModal open={marketOpen} onClose={() => setMarketOpen(false)} /></MountOnce>
      <MountOnce on={!!programId}><ProgramRunner programId={programId} onClose={() => setProgramId(null)} /></MountOnce>
      <MountOnce on={!!hubId}><WorkoutHub programId={hubId} onClose={() => setHubId(null)} /></MountOnce>
      <MountOnce on={reviewOpen}><WeeklyReview open={reviewOpen} onClose={() => setReviewOpen(false)} /></MountOnce>
      <ShortcutsHelp open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <Toaster />
    </div>
  );
}
