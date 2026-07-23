import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { usePomodoroState, fmtSec } from '@/lib/pomodoroState';
import { isoDate } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompress';
import { getCustomWallpapers, addCustomWallpaper, removeCustomWallpaper } from '@/lib/theme';
import { preloadImages } from '@/lib/preload';
import { notify } from '@/lib/notifications';
import {
  X, Pause, Play, Square, SkipForward, Volume2, VolumeX, Youtube, Plus, Trash2,
  CheckCircle2, Flame, Image as ImageIcon,
  Lock, BellOff, Maximize, BarChart3, Upload, Coffee, Clapperboard, Sliders, Search,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { YouTubeBg } from '@/components/LiveWallpaper';
import { useSoundscape, LAYERS, MIX_PRESETS } from '@/lib/soundscape';
import { useYtPlayer, ytThumb } from '@/lib/ytPlayer';
import { PriorityDot } from '@/components/ui/priority-dot';
import { loadFocusSession, saveFocusSession, type FocusSession } from '@/lib/focusSession';

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

/* ==================== Обои ==================== */

const WALLPAPERS = Array.from({ length: 20 }, (_, i) => `/wallpapers/wp${i + 1}.jpg`);
const WP_KEY = 'focus.wallpaper.v1';

const glass = 'rounded-xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.35)]';

/* Аккуратный тумблер */
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

/* Круглая кнопка-тоггл в панели управления */
const ToolButton: React.FC<{ active?: boolean; onClick: () => void; title: string; children: React.ReactNode }> = ({ active, onClick, title, children }) => (
  <button
    onClick={onClick}
    title={title}
    className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${active ? 'text-white bg-white/15' : 'text-white/55 hover:text-white hover:bg-white/10'}`}
  >
    {children}
  </button>
);

type PanelKey = 'wp' | 'yt' | 'mixer' | 'blockers' | 'stats' | 'time';

interface Props {
  open: boolean;
  initialTaskId?: string | null;
  onClose: () => void;
}

export const FocusMode: React.FC<Props> = ({ open, initialTaskId, onClose }) => {
  const { tasks, timeEntries, toggleTask, addTask, updateTask, removeTask, startTimeEntry, finishTimeEntry } = useStore();
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
  const [running, setRunning] = useState(false);
  const tickRef = useRef<number | null>(null);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  // Момент конца текущей фазы (мс). Таймер считается от него — переживает перезагрузку/новую вкладку.
  const endsAtRef = useRef<number | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tasksExpanded, setTasksExpanded] = useState(true); // задачи дня видны по умолчанию
  const [newTask, setNewTask] = useState('');
  const [newPriority, setNewPriority] = useState(3);
  // Инлайн-редактирование названия задачи
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  // Единственная открытая панель-попап (взаимоисключающие) — вместо разрозненных флагов
  const [panel, setPanel] = useState<PanelKey | null>(null);
  const togglePanel = (k: PanelKey) => setPanel((p) => (p === k ? null : k));

  // Микшер: громкость каждого слоя 0..1 (0 = выключен)
  // Глобальный звуковой движок — звук не прерывается при выходе из фокуса
  const { mix, master, paused: soundPaused, setLayer, setMaster, applyPreset: applyMixPreset, stopAll: stopAllSound, togglePause: toggleSoundPause } = useSoundscape();
  const anySound = Object.keys(mix).length > 0;

  // YouTube — плеер глобальный (MiniPlayer в App), поэтому музыка продолжает играть после выхода.
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

  const today = isoDate(new Date());
  const sessionTasks = useMemo(
    () => tasks.filter((t) => t.date === today && !t.parent_id).sort((a, b) => (a.status === b.status ? a.priority - b.priority : a.status === 'done' ? 1 : -1)).slice(0, 12),
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

  // Инлайн-редактирование названия
  const startEdit = (id: string, title: string) => { setEditingId(id); setEditValue(title); };
  const commitEdit = () => {
    if (editingId) {
      const v = editValue.trim();
      if (v) updateTask(editingId, { title: v });
    }
    setEditingId(null);
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

  // Восстановление сессии при открытии: продолжаем таймер с того же места (перезагрузка/новая вкладка)
  useEffect(() => {
    if (open) {
      const s = loadFocusSession();
      elapsedRef.current = 0;
      if (s) {
        setPomodoro(s.pomodoro); setCycleIdx(s.cycleIdx); setTimerIdx(s.timerIdx); setPhase(s.phase);
        if (initialTaskId) setSelectedId(initialTaskId); else setSelectedId(s.selectedId);
        const phaseSecs = (s.pomodoro
          ? (s.phase === 'work' ? CYCLES[s.cycleIdx].work : CYCLES[s.cycleIdx].rest)
          : TIMERS[s.timerIdx]) * 60;
        if (s.running && s.endsAt && s.endsAt > Date.now()) {
          endsAtRef.current = s.endsAt;
          setSecondsLeft(Math.ceil((s.endsAt - Date.now()) / 1000));
          setRunning(true);
          setZen(true);
        } else {
          endsAtRef.current = null;
          setSecondsLeft(s.running ? 0 : (s.secondsLeft || phaseSecs)); // running+истёк = фаза закончилась
          setRunning(false);
        }
      } else {
        setPhase('work');
        setSecondsLeft(work * 60);
        setRunning(false);
        endsAtRef.current = null;
        if (initialTaskId) setSelectedId(initialTaskId);
      }
    } else {
      stop();
      // Музыку НЕ трогаем: плеер глобальный и продолжает играть вне фокуса
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Тик считает остаток от endsAt (а не декрементом) — устойчив к перезагрузке и заморозке вкладки
  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      const left = endsAtRef.current ? Math.ceil((endsAtRef.current - Date.now()) / 1000) : 0;
      if (left <= 0) { onPhaseEnd(); setSecondsLeft(0); return; }
      elapsedRef.current += 1;
      setSecondsLeft(left);
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, phase, cycleIdx, timerIdx, pomodoro]);

  // Сохраняем сессию при изменении running/фазы/конфига (не на каждый тик — endsAt стабилен)
  useEffect(() => {
    if (!open) return;
    const s: FocusSession = {
      running, phase, pomodoro, cycleIdx, timerIdx, selectedId,
      endsAt: running ? endsAtRef.current : null,
      secondsLeft,
    };
    saveFocusSession(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running, phase, pomodoro, cycleIdx, timerIdx, selectedId]);

  // Страховка: сохраняем актуальное состояние при закрытии/сворачивании вкладки (beforeunload не всегда
  // успевает; visibilitychange надёжнее в браузерах). Так «новая вкладка» и перезагрузка точно подхватят сессию.
  useEffect(() => {
    if (!open) return;
    const save = () => saveFocusSession({
      running, phase, pomodoro, cycleIdx, timerIdx, selectedId,
      endsAt: running ? endsAtRef.current : null, secondsLeft,
    });
    window.addEventListener('beforeunload', save);
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => {
      window.removeEventListener('beforeunload', save);
      window.removeEventListener('pagehide', save);
      document.removeEventListener('visibilitychange', save);
    };
  }, [open, running, phase, pomodoro, cycleIdx, timerIdx, selectedId, secondsLeft]);

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
    // фиксируем момент конца фазы — от него считается таймер и восстановление после перезагрузки
    endsAtRef.current = Date.now() + secondsLeft * 1000;
    setRunning(true);
    setZen(true);
    setPanel(null);
    // сохраняем сразу (не дожидаясь эффекта) — иначе гонка на монтировании могла бы потерять запись
    saveFocusSession({ running: true, phase, pomodoro, cycleIdx, timerIdx, selectedId, endsAt: endsAtRef.current, secondsLeft });
  };
  const pause = () => {
    setRunning(false); setZen(false); endsAtRef.current = null;
    saveFocusSession({ running: false, phase, pomodoro, cycleIdx, timerIdx, selectedId, endsAt: null, secondsLeft });
  };
  // stop() лишь финализирует таймер/запись — НЕ трогает персист (иначе монтирование с open=false
  // при загрузке стёрло бы сохранённую сессию до того, как её прочитает авто-возобновление).
  const stop = () => {
    setRunning(false);
    setZen(false);
    endsAtRef.current = null;
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
        endsAtRef.current = null;
        setSecondsLeft(work * 60);
        saveFocusSession(null); // простой таймер отработал — сессия закрыта
        return;
      }
      if (!blockNotifs) void notify('Focus Mode', { body: `Помидор ${work} мин завершён — отдых ${rest} мин` });
      setPhase('rest');
      setSecondsLeft(rest * 60);
      endsAtRef.current = Date.now() + rest * 60 * 1000; // фаза сменилась — новый endsAt для персиста
    } else {
      const next = nextTaskAfter(selectedId);
      setSelectedId(next);
      setPhase('work');
      setSecondsLeft(work * 60);
      endsAtRef.current = Date.now() + work * 60 * 1000;
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
    addTask({ title: v, date: today, priority: newPriority });
    setNewTask('');
  };

  // Явный выход пользователя — завершаем и стираем сессию (в отличие от перезагрузки)
  const close = () => { stop(); saveFocusSession(null); onClose(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (e.key === 'Escape') { if (editingId) { setEditingId(null); return; } if (panel) { setPanel(null); return; } close(); }
      if (e.key === ' ' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); running ? pause() : start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running, panel, editingId]);

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
        <div className="flex items-center gap-3">
          {/* Поиск по делам / Google прямо из фокуса — палитра открывается поверх */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('thedad:search'))}
            className={`flex items-center gap-2 ${glass} !rounded-full px-4 py-2 text-sm text-white/60 hover:text-white transition-colors`}
            title="Поиск по задачам и в Google (⌘K)"
          >
            <Search className="h-4 w-4" />
            <span className="hidden sm:inline">Поиск</span>
            <kbd className="hidden sm:inline text-[10px] bg-white/10 rounded px-1.5 py-0.5">⌘K</kbd>
          </button>
          <div className={`hidden lg:flex items-center gap-2 ${glass} !rounded-full px-4 py-2 text-sm`}>
            <span className="h-2 w-2 rounded-full bg-white/80" /> Focus Mode
          </div>
        </div>
      </div>

      {/* Центрированная колонка — всё в одном столбце, боковые панели убраны */}
      <div className="relative z-10 flex flex-col items-center gap-6 px-4 py-8 max-w-[560px] mx-auto min-h-[calc(100vh-84px)] justify-center">
        {/* Круг-таймер */}
        <div
          className="relative transition-[transform] duration-700"
          style={{ transform: zen ? `scale(${zenScale})` : 'scale(1)', transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          {zen && (
            <button
              onClick={() => setZen(false)}
              className={`absolute -right-16 top-1/2 -translate-y-1/2 z-20 h-12 w-12 ${glass} !rounded-full flex items-center justify-center text-white/70 hover:text-white transition-[color,transform] hover:scale-110`}
              title="Показать задачи и управление"
            >
              <Sliders className="h-5 w-5" />
            </button>
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

        {/* В зен-режиме список скрыт — но показываем текущую задачу, чтобы понимать, что делать.
            Клик разворачивает полный список (выходит из зена). */}
        {zen && phase === 'work' && (
          <button
            onClick={() => setZen(false)}
            className="text-center group"
            title="Показать все задачи"
          >
            <div className="text-[11px] uppercase tracking-widest text-white/40 mb-1">Сейчас в работе</div>
            <div className="text-xl font-semibold text-white/90 group-hover:text-white transition-colors max-w-[420px] truncate">
              {activeTask?.title ?? 'Свободный фокус — без конкретной задачи'}
            </div>
            {nextPending && <div className="text-xs text-white/40 mt-1">дальше: {nextPending.title}</div>}
            <div className="text-[10px] text-white/25 mt-1.5">нажми, чтобы увидеть все задачи</div>
          </button>
        )}

        {/* ===== Задачи дня (цели сессии слиты сюда) — скрываются в зене ===== */}
        <div className={`w-full transition-[opacity,transform] duration-500 ${zen ? 'opacity-0 translate-y-4 pointer-events-none h-0 overflow-hidden' : ''}`}>
          {phase === 'rest' ? (
            <div className="text-center min-h-[64px]">
              <div className="text-[11px] uppercase tracking-widest text-sky-300/60 mb-1.5">Перерыв</div>
              <div className="flex items-center justify-center gap-2.5">
                <Coffee className="h-5 w-5 text-sky-300 shrink-0" />
                <span className="text-xl font-semibold leading-snug text-sky-100">Отдых {rest} мин — отойди от экрана</span>
              </div>
            </div>
          ) : (
            <div className={`${glass} p-4`}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] uppercase tracking-widest text-white/45">Задачи дня</span>
                {sessionTasks.length > 0 && <span className="text-[11px] text-white/40 tabular-nums">{doneCount}/{sessionTasks.length}</span>}
                <div className="flex-1" />
                {sessionTasks.length > 0 && (
                  <>
                    <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full rounded-full bg-white/80 transition-[width] duration-500" style={{ width: `${sessionPct}%` }} />
                    </div>
                    <span className="text-[11px] text-white/50 tabular-nums w-9 text-right">{sessionPct}%</span>
                  </>
                )}
              </div>

              {/* Список задач: чек, цветной кружок важности (клик → палитра), редактируемое название.
                  layout-анимация — выполненная задача плавно съезжает вниз, а не телепортируется. */}
              <ul className="flex flex-col gap-1.5 max-h-[34vh] overflow-y-auto pr-0.5 -mr-0.5">
                {sessionTasks.length === 0 && (
                  <li className="text-sm text-white/35 py-2">Нет задач на сегодня — добавь первую ниже, дальше просто работай.</li>
                )}
                <AnimatePresence initial={false}>
                {(tasksExpanded ? sessionTasks : activeTask ? [activeTask] : []).map((t) => (
                  <motion.li
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                    className={`group flex items-center gap-2.5 rounded-lg px-2 py-1.5 ${activeTask?.id === t.id ? 'bg-white/10 ring-1 ring-white/20' : 'hover:bg-white/[0.05]'}`}
                  >
                    <button
                      onClick={() => checkTask(t.id)}
                      className="h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all hover:scale-110"
                      style={{ background: t.status === 'done' ? 'rgba(255,255,255,0.9)' : 'transparent', borderColor: t.status === 'done' ? 'transparent' : 'rgba(255,255,255,0.35)' }}
                      title={t.status === 'done' ? 'Снять отметку' : 'Выполнить'}
                    >
                      {t.status === 'done' && <CheckCircle2 className="h-3.5 w-3.5 text-black/70" />}
                    </button>

                    <PriorityDot priority={t.priority} onChange={(p) => updateTask(t.id, { priority: p })} tone="dark" size={12} />

                    {editingId === t.id ? (
                      <input
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={commitEdit}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        className="flex-1 min-w-0 bg-white/10 rounded px-2 py-1 text-sm outline-none focus:bg-white/15"
                      />
                    ) : (
                      <button
                        onClick={() => setSelectedId(selectedId === t.id ? null : t.id)}
                        onDoubleClick={() => startEdit(t.id, t.title)}
                        className={`flex-1 min-w-0 text-left text-sm leading-snug truncate ${t.status === 'done' ? 'line-through text-white/40' : 'text-white/90'}`}
                        title="Клик — сделать активной · двойной клик — переименовать"
                      >
                        {t.title}
                      </button>
                    )}

                    <button
                      onClick={() => startEdit(t.id, t.title)}
                      className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition-opacity shrink-0 text-[11px] px-1"
                      title="Переименовать"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => removeTask(t.id)}
                      className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity shrink-0"
                      title="Удалить задачу"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </motion.li>
                ))}
                </AnimatePresence>
              </ul>

              {!tasksExpanded && nextPending && (
                <div className="text-[11px] text-white/35 mt-1.5 px-2">дальше: {nextPending.title}</div>
              )}

              {/* Добавление задачи: кружок важности (клик → выбор цвета) + поле */}
              <div className="flex items-center gap-2 mt-3">
                <PriorityDot priority={newPriority} onChange={setNewPriority} tone="dark" size={14} title="Важность новой задачи — клик, чтобы выбрать цвет" />
                <input
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submitNewTask()}
                  placeholder="Новая задача…"
                  className="flex-1 rounded-lg bg-white/[0.06] border border-white/10 px-3 py-2 text-sm placeholder:text-white/25 outline-none focus:border-white/50"
                />
                <button onClick={submitNewTask} className="h-9 w-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors shrink-0" title="Добавить">
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              {sessionTasks.length > 1 && (
                <button onClick={() => setTasksExpanded((v) => !v)} className="mt-2 text-[11px] text-white/40 hover:text-white transition-colors">
                  {tasksExpanded ? 'Показать только активную' : `Показать все (${sessionTasks.length})`}
                </button>
              )}
            </div>
          )}
        </div>

        {/* ===== Панель управления — кружки-тогглы, скрывается в зене ===== */}
        <div className={`flex flex-col items-center gap-3 w-full transition-opacity duration-500 ${zen ? 'opacity-0 pointer-events-none' : ''}`}>
          <div className={`flex items-center gap-1.5 ${glass} p-2 flex-wrap justify-center`}>
            {/* 🍅 — переключатель типа сессий */}
            <button
              onClick={toggleMode}
              disabled={running}
              title={pomodoro ? 'Помодоро: работа + отдых. Клик — простой таймер' : 'Простой таймер. Клик — помодоро с перерывами'}
              className={`h-10 w-10 rounded-full text-base select-none transition-all disabled:opacity-40 ${
                pomodoro ? 'ring-1 ring-red-300/70 bg-white/10' : 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0 hover:bg-white/10'
              }`}
            >🍅</button>

            {/* Одна кнопка с текущей длительностью — клик открывает выбор (убрали 3 лишние кнопки) */}
            <ToolButton
              active={panel === 'time'}
              onClick={() => { if (!running) togglePanel('time'); }}
              title={running ? 'Идёт сессия — длительность нельзя менять' : pomodoro ? `${work} мин работа · ${rest} мин отдых. Клик — выбрать другое` : `Таймер ${work} мин. Клик — выбрать другое`}
            >
              <span className={`text-sm font-semibold tabular-nums ${running ? 'opacity-40' : ''}`}>{work}</span>
            </ToolButton>
            <span className="h-6 w-px bg-white/10" />

            {/* Пауза/стоп/скип — на весь звук сразу */}
            <ToolButton onClick={pauseAllSound} title={allPaused ? 'Продолжить звук' : 'Пауза звука'}>
              {allPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </ToolButton>
            <ToolButton onClick={() => { stopAllSound(); stopYt(); }} title="Стоп звук">
              <VolumeX className="h-4 w-4" />
            </ToolButton>
            <span className="h-6 w-px bg-white/10" />

            {/* Тогглы панелей */}
            <ToolButton active={panel === 'mixer'} onClick={() => togglePanel('mixer')} title="Звуковой микшер">
              <Sliders className="h-4 w-4" />
            </ToolButton>
            <ToolButton active={panel === 'yt' || !!ytActive} onClick={() => togglePanel('yt')} title="Focus-видео (YouTube)">
              <Youtube className="h-4.5 w-4.5" />
            </ToolButton>
            <ToolButton active={panel === 'wp'} onClick={() => togglePanel('wp')} title="Сменить фон">
              <ImageIcon className="h-4 w-4" />
            </ToolButton>
            <ToolButton active={panel === 'blockers'} onClick={() => togglePanel('blockers')} title="Отвлечения и полный экран">
              <Lock className="h-4 w-4" />
            </ToolButton>
            <ToolButton active={panel === 'stats'} onClick={() => togglePanel('stats')} title="Статистика фокуса">
              <BarChart3 className="h-4 w-4" />
            </ToolButton>
          </div>

          {/* ===== Попап-панели (взаимоисключающие) ===== */}
          {panel === 'time' && (
            <div className={`${glass} p-3 w-full max-w-md`}>
              <div className="text-[11px] uppercase tracking-widest text-white/45 mb-2.5 px-1">Длительность сессии</div>
              <div className="grid grid-cols-4 gap-2">
                {pomodoro ? CYCLES.map((c, i) => (
                  <button
                    key={c.work}
                    onClick={() => { setCycleIdx(i); setPhase('work'); if (!running) setSecondsLeft(c.work * 60); setPanel(null); }}
                    title={`${c.work} мин работа · ${c.rest} мин отдых`}
                    className={`rounded-xl py-2.5 flex flex-col items-center transition-all ${
                      cycleIdx === i ? 'ring-1 ring-white/70 text-white bg-white/10' : 'text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/10'
                    }`}
                  >
                    <span className="text-base font-semibold tabular-nums leading-none">{c.work}</span>
                    <span className="text-[10px] text-white/40 mt-1">+{c.rest} отдых</span>
                  </button>
                )) : TIMERS.map((m, i) => (
                  <button
                    key={m}
                    onClick={() => { setTimerIdx(i); setPhase('work'); if (!running) setSecondsLeft(m * 60); setPanel(null); }}
                    title={`Таймер ${m} мин без перерывов`}
                    className={`rounded-xl py-2.5 flex flex-col items-center transition-all ${
                      timerIdx === i ? 'ring-1 ring-white/70 text-white bg-white/10' : 'text-white/60 hover:text-white bg-white/[0.04] hover:bg-white/10'
                    }`}
                  >
                    <span className="text-base font-semibold tabular-nums leading-none">{m}</span>
                    <span className="text-[10px] text-white/40 mt-1">мин</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {panel === 'mixer' && (
            <div className={`${glass} p-4 w-full max-w-md`}>
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
                <input type="range" min="0" max="1" step="0.05" value={master} onChange={(e) => setMaster(Number(e.target.value))} className="w-full accent-white" />
              </div>
            </div>
          )}

          {panel === 'yt' && (
            <div className={`${glass} p-4 w-full max-w-md`}>
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
                    <button onClick={nextYt} className="h-9 w-9 rounded-full text-white/55 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors" title="Следующий трек">
                      <SkipForward className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <Volume2 className="h-4 w-4 text-white/40 shrink-0" />
                    <input type="range" min="0" max="100" step="5" value={ytVolume} onChange={(e) => changeYtVolume(Number(e.target.value))} className="w-full accent-white" />
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
                    <a
                      href={`https://www.youtube.com/watch?v=${v.id}`}
                      target="_blank" rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      title="Открыть на YouTube (если не встраивается)"
                      className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-white transition-opacity shrink-0"
                    >
                      <Youtube className="h-3.5 w-3.5" />
                    </a>
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
              <p className="text-[11px] text-white/30 mt-2 leading-relaxed">Некоторые ролики автор запретил встраивать — они не запустятся. Плеер сам перейдёт к следующему; такой ролик можно открыть на YouTube значком справа.</p>
            </div>
          )}

          {panel === 'wp' && (
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

          {panel === 'blockers' && (
            <div className={`${glass} p-4 w-full max-w-md`}>
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
            </div>
          )}

          {panel === 'stats' && (
            <div className={`${glass} p-4 w-full max-w-md`}>
              <div className="grid grid-cols-3 gap-3 text-sm">
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
            </div>
          )}

          <div className="text-xs text-white/35">
            {pomodoro ? `Помидор ${work}/${rest} мин · ${phase === 'rest' ? 'перерыв' : 'работа'}` : `Таймер ${work} мин без перерывов`} · Пробел — старт/пауза
          </div>
        </div>
      </div>
    </div>
  );
};
