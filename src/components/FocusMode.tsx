import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { usePomodoroState, fmtSec } from '@/lib/pomodoroState';
import { isoDate } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompress';
import { getCustomWallpapers, addCustomWallpaper, removeCustomWallpaper } from '@/lib/theme';
import { preloadImages } from '@/lib/preload';
import { notify } from '@/lib/notifications';
import { QUOTES, quoteOfDay } from '@/lib/quotes';
import {
  X, Pause, Play, Square, SkipForward, Volume2, VolumeX, Youtube, Plus, Trash2,
  CheckCircle2, Flame, Waves, CloudRain, Wind, TreePine, Image as ImageIcon,
  Lock, BellOff, Maximize, BarChart3, Upload, CloudLightning, FlameKindling, MoonStar,
  ChevronDown, Coffee, Clapperboard,
} from 'lucide-react';
import { YouTubeBg } from '@/components/LiveWallpaper';
import { useSoundscape, LAYERS, MIX_PRESETS, type LayerKey } from '@/lib/soundscape';
import { useYtPlayer, ytThumb } from '@/lib/ytPlayer';

// Помидоро-циклы: работа + отдых (мин). Когда цикл завершается — переходим к новой задаче.
const CYCLES = [
  { work: 75, rest: 15 },
  { work: 50, rest: 10 },
  { work: 25, rest: 5 },
  { work: 12, rest: 3 },
] as const;

// Простой таймер — только работа, без фаз отдыха. 🍅 переключает между режимами.
const TIMERS = [90, 60, 30, 15] as const;
const MODE_KEY = 'focus.mode.v1';

const PRIORITY_COLOR: Record<number, string> = { 1: '#ef4444', 2: '#f59e0b', 3: '#64748b' };


/* ==================== Обои ==================== */

const WALLPAPERS = Array.from({ length: 20 }, (_, i) => `/wallpapers/wp${i + 1}.jpg`);
const WP_KEY = 'focus.wallpaper.v1';

const glass = 'rounded-xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.35)]';

/* Панели фокуса скрываются по клику на заголовок; состояние переживает перезаход */
const PANELS_KEY = 'focus.panels.v1';
function loadCollapsed(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(PANELS_KEY) || '{}'); } catch { return {}; }
}

const Panel: React.FC<{
  title: string;
  icon?: React.ElementType;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}> = ({ title, icon: Icon, collapsed, onToggle, children }) => (
  <div className={`${glass} overflow-hidden`}>
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 px-5 py-3 text-sm font-semibold text-left text-white/85 hover:text-white transition-colors"
      title={collapsed ? 'Показать' : 'Скрыть'}
    >
      {Icon && <Icon className="h-4 w-4 shrink-0 text-white/50" />}
      <span className="flex-1 min-w-0 truncate">{title}</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-white/40 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
    </button>
    {!collapsed && <div className="px-5 pb-5">{children}</div>}
  </div>
);

/* Аккуратный тумблер (фикс поехавшей вёрстки) */
const Toggle: React.FC<{ on: boolean; onToggle: () => void }> = ({ on, onToggle }) => (
  <button
    onClick={onToggle}
    className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? 'bg-emerald-400/80' : 'bg-white/15'}`}
    role="switch"
    aria-checked={on}
  >
    <span className={`absolute top-0.5 left-0 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
  </button>
);

interface Props {
  open: boolean;
  initialTaskId?: string | null;
  onClose: () => void;
}

export const FocusMode: React.FC<Props> = ({ open, initialTaskId, onClose }) => {
  const { tasks, timeEntries, toggleTask, addTask, startTimeEntry, finishTimeEntry } = useStore();
  const setGlobal = usePomodoroState((s) => s.set);

  // 🍅 переключает тип сессий: помодоро (работа+отдых) ↔ простой таймер (только работа)
  const [pomodoro, setPomodoro] = useState(() => localStorage.getItem(MODE_KEY) !== 'timer');
  const [cycleIdx, setCycleIdx] = useState(2); // 25/5 по умолчанию (классический помидор)
  const [timerIdx, setTimerIdx] = useState(1); // 60 мин по умолчанию для простого таймера
  const work = pomodoro ? CYCLES[cycleIdx].work : TIMERS[timerIdx];
  const rest = pomodoro ? CYCLES[cycleIdx].rest : 0;
  const [phase, setPhase] = useState<'work' | 'rest'>('work');
  const phaseMin = phase === 'work' ? work : rest;
  const [secondsLeft, setSecondsLeft] = useState(CYCLES[2].work * 60);
  // Свёрнутые панели (скрываются кликом по заголовку)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(loadCollapsed);
  // def — состояние по умолчанию (стата исторически свёрнута)
  const togglePanel = (id: string, def = false) => setCollapsed((c) => {
    const next = { ...c, [id]: !(c[id] ?? def) };
    try { localStorage.setItem(PANELS_KEY, JSON.stringify(next)); } catch {}
    return next;
  });
  const [running, setRunning] = useState(false);
  const tickRef = useRef<number | null>(null);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasksExpanded, setTasksExpanded] = useState(true); // задачи дня видны по умолчанию
  const [newTask, setNewTask] = useState('');

  // Микшер: громкость каждого слоя 0..1 (0 = выключен)
  // Глобальный звуковой движок — звук не прерывается при выходе из фокуса
  const { mix, master, paused: soundPaused, setLayer, setMaster, applyPreset: applyMixPreset, stopAll: stopAllSound, togglePause: toggleSoundPause } = useSoundscape();
  const anySound = Object.keys(mix).length > 0;

  // YouTube — панель открыта по умолчанию. Сам плеер глобальный (MiniPlayer в App),
  // поэтому музыка продолжает играть после выхода из фокуса.
  const [ytOpen, setYtOpen] = useState(true);
  const [ytUrl, setYtUrl] = useState('');
  const {
    list: ytList, activeId: ytActive, playing: ytPlaying, volume: ytVolume,
    play: playYt, togglePlay: toggleYtPlay, next: nextYt, stop: stopYt,
    setVolume: changeYtVolume, addByUrl: addYtUrl, remove: removeYt,
  } = useYtPlayer();

  const [wallpaper, setWallpaper] = useState<string>(() => localStorage.getItem(WP_KEY) || WALLPAPERS[13]);
  // Видео из плейлиста как фон фокуса (YouTube id), переживает перезаход
  const [videoBg, setVideoBgState] = useState<string | null>(() => localStorage.getItem('focus.videobg.v1'));
  const setVideoBg = (id: string | null) => {
    setVideoBgState(id);
    try { if (id) localStorage.setItem('focus.videobg.v1', id); else localStorage.removeItem('focus.videobg.v1'); } catch {}
  };
  const [customWp, setCustomWp] = useState<string[]>(getCustomWallpapers);
  const [wpOpen, setWpOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [blockNotifs, setBlockNotifs] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  // Зен-режим: при старте панели сворачиваются, круг-счётчик увеличивается
  const [zen, setZen] = useState(false);
  // Масштаб круга в зене — от высоты экрана (на 2K заметно крупнее, чем на ноутбуке)
  const [zenScale, setZenScale] = useState(1.2);
  useEffect(() => {
    const calc = () => setZenScale(Math.min(1.85, Math.max(1.15, (window.innerHeight - 360) / 320)));
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, []);

  // Прогреваем кеш обоев при входе в фокус — переключение фона без «проявления» картинки
  useEffect(() => { if (open) preloadImages([...customWp, ...WALLPAPERS]); }, [open, customWp]);

  const quote = useMemo(() => (open ? QUOTES[Math.floor(Math.random() * QUOTES.length)] : quoteOfDay()), [open]);

  const today = isoDate(new Date());
  const sessionTasks = useMemo(
    () => tasks.filter((t) => t.date === today && !t.parent_id).sort((a, b) => (a.status === b.status ? a.priority - b.priority : a.status === 'done' ? 1 : -1)).slice(0, 7),
    [tasks, today],
  );
  const doneCount = sessionTasks.filter((t) => t.status === 'done').length;
  const sessionPct = sessionTasks.length ? Math.round((doneCount / sessionTasks.length) * 100) : 0;
  const currentTask = selectedId ? sessionTasks.find((t) => t.id === selectedId) ?? null : null;
  // Активная задача: выбранная вручную или первая невыполненная (по умолчанию)
  const firstPending = sessionTasks.find((t) => t.status !== 'done') ?? null;
  const activeTask = currentTask ?? firstPending;
  const nextPending = sessionTasks.find((t) => t.status !== 'done' && t.id !== activeTask?.id) ?? null;

  // Отметить задачу; если это была активная — переходим к следующей невыполненной
  const checkTask = (id: string) => {
    toggleTask(id);
    if (id === activeTask?.id) {
      const nxt = sessionTasks.find((t) => t.status !== 'done' && t.id !== id);
      setSelectedId(nxt?.id ?? null);
    }
  };

  const focusToday = useMemo(() => Math.round(timeEntries
    .filter((e) => e.type === 'pomodoro' && isoDate(new Date(e.started_at)) === today)
    .reduce((s, e) => s + e.duration, 0) / 60), [timeEntries, today]);

  const focusStreak = useMemo(() => {
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = isoDate(new Date(Date.now() - i * 86400000));
      const has = timeEntries.some((e) => e.type === 'pomodoro' && e.duration >= 300 && isoDate(new Date(e.started_at)) === d);
      if (has) s++; else if (i > 0) break;
    }
    return s;
  }, [timeEntries]);

  useEffect(() => {
    if (open) {
      setPhase('work');
      setSecondsLeft(work * 60);
      setRunning(false);
      elapsedRef.current = 0;
      if (initialTaskId) setSelectedId(initialTaskId); // фокус на конкретной задаче (из списка задач)
    } else {
      stop();
      // Музыку НЕ трогаем: плеер глобальный и продолжает играть вне фокуса
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { onPhaseEnd(); return 0; }
        elapsedRef.current += 1;
        return s - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, cycleIdx, timerIdx, pomodoro]);

  useEffect(() => {
    setGlobal({ running, phase, secondsLeft, taskTitle: currentTask?.title ?? 'Focus' });
    return () => setGlobal({ running: false, secondsLeft: 0, taskTitle: null });
  }, [running, phase, secondsLeft, setGlobal, currentTask]);

  // Следующая невыполненная задача после текущей (для авто-перехода между помидорами)
  const nextTaskAfter = (id: string | null): string | null => {
    const pending = sessionTasks.filter((t) => t.status !== 'done');
    if (pending.length === 0) return null;
    if (!id) return pending[0].id;
    const idx = pending.findIndex((t) => t.id === id);
    return pending[(idx + 1) % pending.length]?.id ?? pending[0].id;
  };

  const start = () => {
    if (!entryRef.current && phase === 'work') {
      const e = startTimeEntry(currentTask?.id ?? null, 'pomodoro');
      entryRef.current = e.id;
      elapsedRef.current = 0;
    }
    setRunning(true);
    setZen(true);
  };
  const pause = () => { setRunning(false); setZen(false); };
  const stop = () => {
    setRunning(false);
    setZen(false);
    if (entryRef.current) {
      finishTimeEntry(entryRef.current, elapsedRef.current);
      entryRef.current = null;
    }
    elapsedRef.current = 0;
  };
  // Конец фазы: работа → отдых; отдых → следующая задача + новый помидор. Таймер продолжает идти.
  // В режиме простого таймера отдыха нет — сессия просто завершается.
  const onPhaseEnd = () => {
    if (phase === 'work') {
      if (entryRef.current) { finishTimeEntry(entryRef.current, work * 60); entryRef.current = null; }
      if (!pomodoro) {
        if (!blockNotifs) void notify('Focus Mode', { body: `Сессия ${work} мин завершена` });
        setRunning(false);
        setZen(false);
        setSecondsLeft(work * 60);
        return;
      }
      if (!blockNotifs) void notify('Focus Mode', { body: `Помидор ${work} мин завершён — отдых ${rest} мин` });
      setPhase('rest');
      setSecondsLeft(rest * 60);
    } else {
      const next = nextTaskAfter(selectedId);
      setSelectedId(next);
      setPhase('work');
      setSecondsLeft(work * 60);
      const e = startTimeEntry(next ?? null, 'pomodoro');
      entryRef.current = e.id;
      elapsedRef.current = 0;
      if (!blockNotifs) void notify('Focus Mode', { body: next ? 'Новый помидор — следующая задача' : 'Новый помидор' });
    }
  };

  // 🍅: помодоро с отдыхом ↔ простой таймер
  const toggleMode = () => {
    if (running) return;
    const next = !pomodoro;
    setPomodoro(next);
    try { localStorage.setItem(MODE_KEY, next ? 'pomodoro' : 'timer'); } catch {}
    setPhase('work');
    setSecondsLeft((next ? CYCLES[cycleIdx].work : TIMERS[timerIdx]) * 60);
  };


  /* ===== YouTube ===== */
  const addYt = () => { if (addYtUrl(ytUrl)) setYtUrl(''); };
  // «Весь звук»: пауза/продолжение разом для атмосферы и YouTube
  const allPaused = (!anySound || soundPaused) && (!ytActive || !ytPlaying);
  const pauseAllSound = () => {
    if (allPaused) {
      if (anySound && soundPaused) toggleSoundPause();
      if (ytActive && !ytPlaying) toggleYtPlay();
    } else {
      if (anySound && !soundPaused) toggleSoundPause();
      if (ytActive && ytPlaying) toggleYtPlay();
    }
  };

  /* ===== Обои ===== */
  const applyWallpaper = (src: string) => {
    setWallpaper(src);
    try { localStorage.setItem(WP_KEY, src); } catch {}
  };
  const uploadWallpaper = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      // сжимаем: сырое фото в base64 пробивало квоту localStorage и «не добавлялось»
      const dataUrl = await compressImage(file);
      setCustomWp(addCustomWallpaper(dataUrl)); // сохраняем в общий список, чтобы не пропало
      applyWallpaper(dataUrl);
    } catch {}
  };
  const delWallpaper = (src: string) => {
    setCustomWp(removeCustomWallpaper(src));
    if (wallpaper === src) applyWallpaper(WALLPAPERS[13]);
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); setFullscreen(false); }
      else { await document.documentElement.requestFullscreen(); setFullscreen(true); }
    } catch {}
  };

  const submitNewTask = () => {
    const v = newTask.trim();
    if (!v) return;
    addTask({ title: v, date: today });
    setNewTask('');
  };

  const close = () => { stop(); onClose(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') close();
      if (e.key === ' ' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); running ? pause() : start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running]);

  if (!open) return null;

  const total = phaseMin * 60;
  const pct = total ? (total - secondsLeft) / total : 0;
  const ringColor = phase === 'rest' ? 'rgba(147,197,253,0.95)' : 'rgba(255,255,255,0.92)';
  const R = 138;
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[200] text-white select-none overflow-y-auto bg-[#0b0a14]">
      <div className="pointer-events-none absolute inset-0">
        {videoBg
          ? <YouTubeBg id={videoBg} />
          : <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper})` }} />}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute bottom-0 inset-x-0 h-1/3" style={{ background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.55))' }} />
      </div>

      {/* Top bar */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-5">
        <button onClick={close} className="flex items-center gap-2 text-white/60 hover:text-white transition-colors">
          <span className={`h-9 w-9 ${glass} !rounded-full flex items-center justify-center`}><X className="h-4 w-4" /></span>
          <span className="text-sm">Выйти из фокуса</span>
          <kbd className="text-[10px] bg-white/10 rounded px-1.5 py-0.5">Esc</kbd>
        </button>
        <div className={`hidden sm:flex items-center gap-3 ${glass} !rounded-full px-4 py-2 text-sm`}>
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-white/80" /> Focus Mode</span>
          <span className="text-white/35 text-xs">вход <kbd className="bg-white/10 rounded px-1 py-0.5">⌘K</kbd> · выход <kbd className="bg-white/10 rounded px-1 py-0.5">Esc</kbd></span>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[300px_1fr_330px] gap-6 px-6 py-8 max-w-[1520px] mx-auto items-start min-h-[calc(100vh-84px)]">
        {/* ЛЕВО */}
        <div className={`order-2 lg:order-1 flex flex-col gap-4 lg:min-h-[70vh] transition-[opacity,transform] duration-500 ease-out ${zen ? 'opacity-0 -translate-x-6 pointer-events-none' : ''}`}>
          <Panel title="Цели фокус-сессии" collapsed={!!collapsed['goals']} onToggle={() => togglePanel('goals')}>
            {sessionTasks.length === 0 && <div className="text-sm text-white/40 mb-2">Добавь первую задачу ниже</div>}
            <ul className="space-y-2">
              {sessionTasks.map((t) => (
                <li
                  key={t.id}
                  onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                  className={`flex items-start gap-2.5 rounded-lg px-2 py-1.5 -mx-2 cursor-pointer transition-colors ${selectedId === t.id ? 'bg-white/10' : 'hover:bg-white/[0.06]'}`}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTask(t.id); }}
                    className="mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110"
                    style={{ background: t.status === 'done' ? 'rgba(255,255,255,0.9)' : 'transparent', borderColor: t.status === 'done' ? 'transparent' : 'rgba(255,255,255,0.3)' }}
                  >
                    {t.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-black/70" />}
                  </button>
                  <span className={`text-sm leading-snug flex-1 ${t.status === 'done' ? 'line-through text-white/35' : 'text-white/85'}`}>{t.title}</span>
                  {t.estimate_min && <span className="text-[11px] text-white/35 tabular-nums shrink-0">{t.estimate_min} мин</span>}
                </li>
              ))}
            </ul>
            {/* Добавление задачи прямо из фокуса */}
            <div className="flex gap-2 mt-3">
              <input
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && submitNewTask()}
                placeholder="+ Новая задача…"
                className="flex-1 rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-sm placeholder:text-white/25 outline-none focus:border-white/50"
              />
              <button onClick={submitNewTask} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
                <Plus className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 pt-4 border-t border-white/[0.08]">
              <div className="flex justify-between text-xs text-white/50 mb-2">
                <span>Прогресс сессии</span>
                <span className="tabular-nums">{doneCount} из {sessionTasks.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-white/80 transition-[width] duration-500" style={{ width: `${sessionPct}%` }} />
              </div>
              <div className="text-xl font-bold tabular-nums mt-2">{sessionPct}%</div>
            </div>
          </Panel>

          <Panel title="Цитата дня" collapsed={!!collapsed['quote']} onToggle={() => togglePanel('quote')}>
            <div className="flex flex-col items-center justify-center text-center py-3">
              <p className="text-sm text-white/60 leading-relaxed max-w-[220px]">«{quote.text}»</p>
              <p className="text-xs text-white/30 mt-3">— {quote.author}</p>
            </div>
          </Panel>

          <Panel title="Статистика фокуса" icon={BarChart3} collapsed={collapsed['stats'] ?? true} onToggle={() => togglePanel('stats', true)}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/35">Фокус сегодня</div>
                  <div className="font-bold tabular-nums mt-0.5">{Math.floor(focusToday / 60) ? `${Math.floor(focusToday / 60)} ч ` : ''}{focusToday % 60} мин</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/35">Задачи</div>
                  <div className="font-bold tabular-nums mt-0.5">{doneCount}/{sessionTasks.length} · {sessionPct}%</div>
                </div>
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-white/35">Серия</div>
                  <div className="font-bold tabular-nums mt-0.5 flex items-center gap-1">{focusStreak} дн <Flame className="h-3.5 w-3.5 text-orange-400" /></div>
                </div>
              </div>
          </Panel>
        </div>

        {/* ЦЕНТР — в зене центрируется по вертикали, круг растёт от размера экрана */}
        <div className={`flex flex-col items-center order-1 lg:order-2 transition-[gap] duration-500 ${zen ? 'justify-center min-h-[calc(100vh-180px)] gap-10' : 'gap-6'}`}>
          <div
            className="relative transition-[transform,margin] duration-700"
            style={{
              transform: zen ? `scale(${zenScale})` : 'scale(1)',
              // transform не раздвигает поток — компенсируем, чтобы круг не наезжал на задачу и панель
              margin: zen ? `${Math.round((320 * (zenScale - 1)) / 2)}px ${Math.round((320 * (zenScale - 1)) / 2) + 80}px` : '0px',
              transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
            }}
          >
            {/* Кнопки возврата панелей — крупные, у самого круга, масштабируются вместе с ним */}
            {zen && (
              <>
                <button
                  onClick={() => setZen(false)}
                  className={`absolute -left-20 top-1/2 -translate-y-1/2 z-20 h-12 w-12 ${glass} !rounded-full flex items-center justify-center text-white/70 hover:text-white transition-[color,transform] hover:scale-110`}
                  title="Показать цели сессии"
                >
                  <BarChart3 className="h-5 w-5" />
                </button>
                <button
                  onClick={() => setZen(false)}
                  className={`absolute -right-20 top-1/2 -translate-y-1/2 z-20 h-12 w-12 ${glass} !rounded-full flex items-center justify-center text-white/70 hover:text-white transition-[color,transform] hover:scale-110`}
                  title="Показать звук и блокировки"
                >
                  <Volume2 className="h-5 w-5" />
                </button>
              </>
            )}
            <svg width="320" height="320">
              <g stroke="rgba(255,255,255,0.18)">
                {ticks.map((i) => {
                  const a = (i / 60) * Math.PI * 2;
                  const big = i % 5 === 0;
                  const r1 = big ? 148 : 152;
                  return (
                    <line
                      key={i}
                      x1={160 + Math.sin(a) * r1} y1={160 - Math.cos(a) * r1}
                      x2={160 + Math.sin(a) * 156} y2={160 - Math.cos(a) * 156}
                      strokeWidth={big ? 2 : 1}
                      opacity={big ? 0.5 : 0.25}
                    />
                  );
                })}
              </g>
              <g className="-rotate-90 origin-center">
                <circle cx="160" cy="160" r={R} stroke="rgba(255,255,255,0.10)" strokeWidth="5" fill="none" />
                <circle
                  cx="160" cy="160" r={R}
                  stroke={ringColor} strokeWidth="5" fill="none"
                  strokeDasharray={2 * Math.PI * R}
                  strokeDashoffset={(1 - pct) * 2 * Math.PI * R}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }}
                />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-[60px] font-bold tabular-nums leading-none">{fmtSec(secondsLeft)}</div>
              <div className="flex items-center gap-2 mt-4">
                {!running ? (
                  <button onClick={start} className={`flex items-center gap-2 ${glass} px-5 py-2.5 text-sm font-medium hover:bg-white/[0.12] transition-[background-color,transform] active:scale-[0.97]`}>
                    <Play className="h-4 w-4" fill="white" /> Старт
                  </button>
                ) : (
                  <button onClick={pause} className={`flex items-center gap-2 ${glass} px-5 py-2.5 text-sm font-medium hover:bg-white/[0.12] transition-[background-color,transform] active:scale-[0.97]`}>
                    <Pause className="h-4 w-4" /> Пауза
                  </button>
                )}
                <button onClick={() => { stop(); setPhase('work'); setSecondsLeft(work * 60); }} className="h-10 w-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/60 hover:text-white transition-colors" title="Сброс таймера">
                  <Square className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="text-center min-h-[64px] w-full max-w-md mx-auto">
            {phase === 'rest' ? (
              /* Перерыв: вместо задачи — надпись «Отдых» */
              <>
                <div className="text-[11px] uppercase tracking-widest text-sky-300/60 mb-1.5">Перерыв</div>
                <div className="flex items-center justify-center gap-2.5">
                  <Coffee className="h-5 w-5 text-sky-300 shrink-0" />
                  <span className="text-xl font-semibold leading-snug text-sky-100">Отдых {rest} мин — отойди от экрана</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <span className="text-[11px] uppercase tracking-widest text-white/35">Задачи дня</span>
                  {sessionTasks.length > 0 && <span className="text-[11px] text-white/40 tabular-nums">{doneCount}/{sessionTasks.length}</span>}
                  {sessionTasks.length > 1 && (
                    <button onClick={() => setTasksExpanded((v) => !v)} className="text-white/40 hover:text-white transition-colors" title={tasksExpanded ? 'Свернуть' : 'Показать все'}>
                      <ChevronDown className={`h-4 w-4 transition-transform ${tasksExpanded ? '' : '-rotate-90'}`} />
                    </button>
                  )}
                </div>

                {sessionTasks.length === 0 ? (
                  <div className="text-sm text-white/35">Свободный фокус — добавь задачи слева или просто работай</div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Текущая (или все — если раскрыто) */}
                    {(tasksExpanded ? sessionTasks : activeTask ? [activeTask] : []).map((t) => (
                      <div
                        key={t.id}
                        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 ${glass} ${activeTask?.id === t.id ? 'ring-1 ring-white/40' : ''}`}
                      >
                        <button
                          onClick={() => checkTask(t.id)}
                          className="h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110"
                          style={{ background: t.status === 'done' ? 'rgba(255,255,255,0.9)' : 'transparent', borderColor: t.status === 'done' ? 'transparent' : 'rgba(255,255,255,0.35)' }}
                        >
                          {t.status === 'done' && <CheckCircle2 className="h-4 w-4 text-black/70" />}
                        </button>
                        <button onClick={() => setSelectedId(t.id)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[t.priority] ?? '#64748b' }} />
                          <span className={`text-base font-semibold leading-snug truncate ${t.status === 'done' ? 'line-through text-white/40' : ''}`}>{t.title}</span>
                        </button>
                      </div>
                    ))}
                    {!tasksExpanded && nextPending && (
                      <div className="text-[11px] text-white/35">дальше: {nextPending.title}</div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Панель управления — тоже сворачивается в зене */}
          <div className={`flex items-center gap-1.5 ${glass} p-2 flex-wrap justify-center transition-opacity duration-500 ${zen ? 'opacity-0 pointer-events-none' : ''}`}>
            {/* 🍅 — переключатель типа сессий: помодоро (работа+отдых) ↔ простой таймер */}
            <button
              onClick={toggleMode}
              disabled={running}
              title={pomodoro ? 'Помодоро: работа + отдых. Клик — простой таймер без перерывов' : 'Простой таймер. Клик — помодоро с перерывами'}
              className={`h-10 w-10 rounded-full text-base select-none transition-all disabled:opacity-40 ${
                pomodoro ? 'ring-1 ring-red-300/70 bg-white/10' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:bg-white/10'
              }`}
            >🍅</button>
            {pomodoro ? CYCLES.map((c, i) => (
              <button
                key={c.work}
                onClick={() => { setCycleIdx(i); setPhase('work'); if (!running) setSecondsLeft(c.work * 60); }}
                disabled={running}
                title={`${c.work} мин работа · ${c.rest} мин отдых`}
                className={`h-10 w-10 rounded-full text-sm font-semibold transition-all disabled:opacity-40 ${
                  cycleIdx === i ? 'ring-1 ring-white/70 text-white bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >{c.work}</button>
            )) : TIMERS.map((m, i) => (
              <button
                key={m}
                onClick={() => { setTimerIdx(i); setPhase('work'); if (!running) setSecondsLeft(m * 60); }}
                disabled={running}
                title={`Таймер ${m} мин без перерывов`}
                className={`h-10 w-10 rounded-full text-sm font-semibold transition-all disabled:opacity-40 ${
                  timerIdx === i ? 'ring-1 ring-white/70 text-white bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >{m}</button>
            ))}
            <span className="h-6 w-px bg-white/10" />
            {/* Пауза/стоп — на весь звук сразу: и атмосфера, и YouTube */}
            <button onClick={pauseAllSound} disabled={!anySound && !ytActive} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30" title={allPaused ? 'Продолжить звук' : 'Пауза звука'}>
              {allPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => { stopAllSound(); stopYt(); }} disabled={!anySound && !ytActive} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30" title="Стоп звук">
              <VolumeX className="h-4 w-4" />
            </button>
            <button onClick={nextYt} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors" title="Следующий трек">
              <SkipForward className="h-4 w-4" />
            </button>
            <span className="h-6 w-px bg-white/10" />
            <button onClick={() => setYtOpen((v) => !v)} className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${ytOpen || ytActive ? 'text-red-300 bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'}`} title="YouTube для фокуса">
              <Youtube className="h-4.5 w-4.5" />
            </button>
            <button onClick={() => setWpOpen((v) => !v)} className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${wpOpen ? 'text-white bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'}`} title="Сменить фон">
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>

          {wpOpen && !zen && (
            <div className={`${glass} p-3 flex items-center gap-2 flex-wrap max-w-lg justify-center`}>
              {[...customWp, ...WALLPAPERS].map((w) => {
                const isCustom = customWp.includes(w);
                return (
                  <div key={w} className="relative group/wp">
                    <button onClick={() => applyWallpaper(w)} className={`h-12 w-20 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${wallpaper === w ? 'border-white/90' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                      <img src={w} alt="" className="h-full w-full object-cover" loading="lazy" />
                    </button>
                    {isCustom && (
                      <button onClick={() => delWallpaper(w)} className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover/wp:opacity-100 transition-opacity" title="Удалить">
                        <X className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              <button onClick={() => fileRef.current?.click()} className="h-12 w-20 rounded-lg border-2 border-dashed border-white/25 hover:border-white/60 flex flex-col items-center justify-center text-white/40 hover:text-white transition-colors" title="Загрузить свой фон">
                <Upload className="h-4 w-4" />
                <span className="text-[9px] mt-0.5">Свой</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadWallpaper} />
            </div>
          )}

          <div className={`text-xs text-white/35 transition-opacity duration-500 ${zen ? 'opacity-0 pointer-events-none' : ''}`}>
            {pomodoro ? `Помидор ${work}/${rest} мин · ${phase === 'rest' ? 'перерыв' : 'работа'}` : `Таймер ${work} мин без перерывов`} · Пробел — старт/пауза
          </div>
        </div>


        {/* ПРАВО */}
        <div className={`space-y-4 order-3 transition-[opacity,transform] duration-500 ease-out ${zen ? 'opacity-0 translate-x-6 pointer-events-none' : ''}`}>
          {/* Отвлечения */}
          <Panel title="Отвлечения заблокированы" icon={Lock} collapsed={!!collapsed['blockers']} onToggle={() => togglePanel('blockers')}>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <BellOff className="h-4 w-4 text-white/40 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-white/70">Уведомления приложения</span>
                <Toggle on={blockNotifs} onToggle={() => setBlockNotifs((v) => !v)} />
              </div>
              <div className="flex items-center gap-3">
                <Maximize className="h-4 w-4 text-white/40 shrink-0" />
                <span className="flex-1 min-w-0 text-sm text-white/70">Полноэкранный режим</span>
                <Toggle on={fullscreen} onToggle={toggleFullscreen} />
              </div>
            </div>
            <p className="text-[11px] text-white/25 mt-3 leading-relaxed">Браузер не может блокировать другие приложения — включи «Не беспокоить» в системе для полного эффекта.</p>
          </Panel>

          {/* Микшер звуков */}
          <Panel title="Звуковой микшер" icon={Volume2} collapsed={!!collapsed['mixer']} onToggle={() => togglePanel('mixer')}>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {MIX_PRESETS.map((p) => (
                <button key={p.label} onClick={() => applyMixPreset(p.mix)} className="rounded-full bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 px-3 py-1 text-xs text-white/70 hover:text-white transition-colors active:scale-[0.97]">
                  {p.label}
                </button>
              ))}
              <button onClick={stopAllSound} className="rounded-full bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 px-3 py-1 text-xs text-white/40 hover:text-white/70 transition-colors">
                Тишина
              </button>
            </div>
            <div className="space-y-2.5">
              {LAYERS.map((l) => {
                const vol = mix[l.key] ?? 0;
                const active = vol > 0;
                return (
                  <div key={l.key} className="flex items-center gap-2.5">
                    <button
                      onClick={() => setLayer(l.key, active ? 0 : 0.6)}
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 transition-all active:scale-[0.95] ${active ? 'bg-white/15 text-white' : 'bg-white/[0.04] text-white/35 hover:text-white/70'}`}
                      title={l.label}
                    >
                      <l.icon className="h-3.5 w-3.5" />
                    </button>
                    <span className={`w-20 shrink-0 text-xs ${active ? 'text-white/80' : 'text-white/35'}`}>{l.label}</span>
                    <input
                      type="range" min="0" max="1" step="0.05" value={vol}
                      onChange={(e) => setLayer(l.key, Number(e.target.value))}
                      className="w-full accent-white opacity-90"
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/[0.08]">
              <Volume2 className="h-4 w-4 text-white/40 shrink-0" />
              <span className="text-xs text-white/40 w-20 shrink-0">Общая</span>
              <input
                type="range" min="0" max="1" step="0.05" value={master}
                onChange={(e) => setMaster(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          </Panel>

          {/* YouTube — открыт по умолчанию */}
          {(ytOpen || ytActive) && (
            <Panel title="Focus-видео" icon={Youtube} collapsed={!!collapsed['youtube']} onToggle={() => togglePanel('youtube')}>
              {/* Сам плеер — глобальный мини-плеер (правый нижний угол): он переживает выход
                  из фокуса. Здесь только выбор трека и громкость. */}
              {ytActive && (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <button onClick={toggleYtPlay} className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0 transition-colors" title={ytPlaying ? 'Пауза' : 'Играть'}>
                      {ytPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" fill="white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{ytList.find((x) => x.id === ytActive)?.title ?? 'YouTube'}</div>
                      <div className="text-[11px] text-white/35">{ytPlaying ? 'играет' : 'на паузе'} · продолжится вне фокуса</div>
                    </div>
                  </div>
                  {/* громкость видео */}
                  <div className="flex items-center gap-3 mb-3">
                    <Volume2 className="h-4 w-4 text-white/40 shrink-0" />
                    <input
                      type="range" min="0" max="100" step="5" value={ytVolume}
                      onChange={(e) => changeYtVolume(Number(e.target.value))}
                      className="w-full accent-white"
                    />
                    <span className="text-xs text-white/40 tabular-nums w-8 text-right">{ytVolume}%</span>
                  </div>
                </>
              )}
              <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {ytList.map((v) => (
                  <li key={v.id} className="group flex items-center gap-2">
                    <button
                      onClick={() => playYt(v.id)}
                      className={`flex-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${ytActive === v.id ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'}`}
                    >
                      <img src={ytThumb(v.id)} alt="" className="h-8 w-12 rounded object-cover shrink-0" loading="lazy" />
                      <span className="truncate">{v.title}</span>
                    </button>
                    <button
                      onClick={() => setVideoBg(videoBg === v.id ? null : v.id)}
                      title={videoBg === v.id ? 'Убрать из фона' : 'Сделать фоном'}
                      className={`shrink-0 transition-opacity ${videoBg === v.id ? 'text-emerald-300' : 'opacity-0 group-hover:opacity-100 text-white/30 hover:text-white'}`}
                    >
                      <Clapperboard className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => removeYt(v.id)} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 mt-3">
                <input
                  value={ytUrl}
                  onChange={(e) => setYtUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addYt()}
                  placeholder="Вставь ссылку YouTube…"
                  className="flex-1 rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-sm placeholder:text-white/25 outline-none focus:border-white/50"
                />
                <button onClick={addYt} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
};
