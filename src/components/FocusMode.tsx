import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { usePomodoroState, fmtSec } from '@/lib/pomodoroState';
import { isoDate } from '@/lib/utils';
import { quoteOfDay, QUOTES } from '@/lib/quotes';
import {
  X, Pause, Play, Square, SkipForward, Volume2, VolumeX, Youtube, Plus, Trash2,
  CheckCircle2, Flame, Waves, CloudRain, Wind, TreePine, Image as ImageIcon,
  Lock, BellOff, Maximize, BarChart3, Upload,
} from 'lucide-react';

const PRESETS = [90, 60, 30, 15] as const;

/* ==================== Интенсивность сессии ==================== */

const INTENSITY = [
  { key: 'light', label: 'Лёгкий фокус' },
  { key: 'work', label: 'Работа' },
  { key: 'deep', label: 'Глубокая работа' },
] as const;
type IntensityKey = typeof INTENSITY[number]['key'];

const PRIORITY_COLOR: Record<number, string> = { 1: '#ef4444', 2: '#f59e0b', 3: '#64748b' };

/* ==================== Генеративные фоновые звуки (WebAudio) ==================== */

type AmbientKey = 'rain' | 'ocean' | 'white' | 'forest';

const AMBIENTS: { key: AmbientKey; label: string; icon: React.ElementType }[] = [
  { key: 'rain', label: 'Дождь', icon: CloudRain },
  { key: 'ocean', label: 'Океан', icon: Waves },
  { key: 'white', label: 'Белый шум', icon: Wind },
  { key: 'forest', label: 'Ручей', icon: TreePine },
];

function noiseBuffer(ctx: AudioContext, brown = false): AudioBuffer {
  const size = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

function startAmbient(ctx: AudioContext, kind: AmbientKey, master: GainNode): () => void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind === 'ocean');
  src.loop = true;
  const nodes: AudioNode[] = [];
  let out: AudioNode = src;

  if (kind === 'rain') {
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
    out.connect(lp); out = lp; nodes.push(lp);
  } else if (kind === 'ocean') {
    const g = ctx.createGain(); g.gain.value = 0.7;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain).connect(g.gain);
    lfo.start();
    out.connect(g); out = g; nodes.push(g, lfo, lfoGain);
  } else if (kind === 'forest') {
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5000;
    out.connect(bp); bp.connect(lp); out = lp; nodes.push(bp, lp);
  } else {
    const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 4000; hs.gain.value = -10;
    out.connect(hs); out = hs; nodes.push(hs);
  }

  out.connect(master);
  src.start(0);
  return () => {
    try { src.stop(); } catch {}
    src.disconnect();
    nodes.forEach((n) => { try { n.disconnect(); (n as OscillatorNode).stop?.(); } catch {} });
  };
}

/* ==================== YouTube ==================== */

interface YtItem { id: string; title: string }

const YT_KEY = 'focus.youtube.v1';
const YT_DEFAULTS: YtItem[] = [
  { id: 'PB8ZrGinWi0', title: 'Focus music · 1' },
  { id: 'X4VbdwhkE10', title: 'Focus music · 2' },
  { id: 'qwosU7e9mqc', title: 'Focus music · 3' },
  { id: 'LEEx_UkHmBU', title: 'Focus music · 4' },
];

function loadYt(): YtItem[] {
  try {
    const raw = localStorage.getItem(YT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return YT_DEFAULTS;
}

function parseYtId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : null);
}

/* ==================== Обои ==================== */

const WALLPAPERS = ['/wallpapers/1.jpg', '/wallpapers/2.png', '/wallpapers/3.png', '/wallpapers/4.png', '/wallpapers/5.png', '/wallpapers/6.png', '/wallpapers/7.png', '/wallpapers/8.png', '/wallpapers/9.png'];
const WP_KEY = 'focus.wallpaper.v1';

/* liquid glass панель */
const glass = 'rounded-xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.35)]';

interface Props {
  open: boolean;
  onClose: () => void;
}

export const FocusMode: React.FC<Props> = ({ open, onClose }) => {
  const { tasks, timeEntries, toggleTask, startTimeEntry, finishTimeEntry } = useStore();
  const setGlobal = usePomodoroState((s) => s.set);

  const [duration, setDuration] = useState(90);
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const [running, setRunning] = useState(false);
  const tickRef = useRef<number | null>(null);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  // Выбранная задача (клик по цели слева) и интенсивность
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intensityManual, setIntensityManual] = useState<IntensityKey | null>(null);

  // Звук
  const [ambient, setAmbient] = useState<AmbientKey | null>(null);
  const [soundPaused, setSoundPaused] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const stopAmbientRef = useRef<(() => void) | null>(null);

  // YouTube
  const [ytOpen, setYtOpen] = useState(false);
  const [ytList, setYtList] = useState<YtItem[]>(loadYt);
  const [ytActive, setYtActive] = useState<string | null>(null);
  const [ytUrl, setYtUrl] = useState('');

  // Обои
  const [wallpaper, setWallpaper] = useState<string>(() => localStorage.getItem(WP_KEY) || WALLPAPERS[0]);
  const [wpOpen, setWpOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Блокировки
  const [blockNotifs, setBlockNotifs] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);

  // Статистика слева внизу
  const [statsOpen, setStatsOpen] = useState(false);

  // Случайная цитата на каждое открытие
  const quote = useMemo(() => (open ? QUOTES[Math.floor(Math.random() * QUOTES.length)] : quoteOfDay()), [open]);

  const today = isoDate(new Date());
  const sessionTasks = useMemo(
    () => tasks.filter((t) => t.date === today && !t.parent_id).sort((a, b) => (a.status === b.status ? a.priority - b.priority : a.status === 'done' ? 1 : -1)).slice(0, 5),
    [tasks, today],
  );
  const doneCount = sessionTasks.filter((t) => t.status === 'done').length;
  const sessionPct = sessionTasks.length ? Math.round((doneCount / sessionTasks.length) * 100) : 0;
  const currentTask = selectedId ? sessionTasks.find((t) => t.id === selectedId) ?? null : null;

  // Интенсивность: вручную или авто от приоритета выбранной задачи
  const intensity: IntensityKey = intensityManual ?? (currentTask ? (currentTask.priority === 1 ? 'deep' : currentTask.priority === 2 ? 'work' : 'light') : 'work');
  const cycleIntensity = () => {
    const idx = INTENSITY.findIndex((x) => x.key === intensity);
    setIntensityManual(INTENSITY[(idx + 1) % INTENSITY.length].key);
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
      setSecondsLeft(duration * 60);
      setRunning(false);
      elapsedRef.current = 0;
    } else {
      stop();
      stopSound();
      setYtActive(null);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (!running) setSecondsLeft(duration * 60); }, [duration, running]);

  useEffect(() => {
    if (!running) return;
    tickRef.current = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) { complete(); return 0; }
        elapsedRef.current += 1;
        return s - 1;
      });
    }, 1000);
    return () => { if (tickRef.current) window.clearInterval(tickRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    setGlobal({ running, phase: 'work', secondsLeft, taskTitle: currentTask?.title ?? 'Focus' });
    return () => setGlobal({ running: false, secondsLeft: 0, taskTitle: null });
  }, [running, secondsLeft, setGlobal, currentTask]);

  const start = () => {
    if (!entryRef.current) {
      const e = startTimeEntry(currentTask?.id ?? null, 'pomodoro');
      entryRef.current = e.id;
      elapsedRef.current = 0;
    }
    setRunning(true);
  };
  const pause = () => setRunning(false);
  const stop = () => {
    setRunning(false);
    if (entryRef.current) {
      finishTimeEntry(entryRef.current, elapsedRef.current);
      entryRef.current = null;
    }
    elapsedRef.current = 0;
  };
  const complete = () => {
    setRunning(false);
    if (entryRef.current) {
      finishTimeEntry(entryRef.current, duration * 60);
      entryRef.current = null;
    }
    if (!blockNotifs) { try { new Notification('Focus Mode', { body: `Сессия ${duration} мин завершена 🎉` }); } catch {} }
  };

  /* Звук */
  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      ctxRef.current = new Ctx();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.connect(ctxRef.current.destination);
    }
    return { ctx: ctxRef.current!, master: masterRef.current! };
  };
  const pickAmbient = (k: AmbientKey | null) => {
    stopAmbientRef.current?.();
    stopAmbientRef.current = null;
    setSoundPaused(false);
    if (k === null || ambient === k) { setAmbient(null); return; }
    try {
      const { ctx, master } = ensureCtx();
      void ctx.resume();
      master.gain.value = volume * 0.12;
      stopAmbientRef.current = startAmbient(ctx, k, master);
      setAmbient(k);
      setYtActive(null);
    } catch {}
  };
  const stopSound = () => {
    stopAmbientRef.current?.();
    stopAmbientRef.current = null;
    setAmbient(null);
    setSoundPaused(false);
  };
  const toggleSoundPause = () => {
    const ctx = ctxRef.current;
    if (!ctx || (!ambient && !ytActive)) return;
    if (soundPaused) { void ctx.resume(); setSoundPaused(false); }
    else { void ctx.suspend(); setSoundPaused(true); }
  };
  const nextSound = () => {
    if (ytActive) {
      const idx = ytList.findIndex((x) => x.id === ytActive);
      if (idx >= 0 && ytList.length > 1) setYtActive(ytList[(idx + 1) % ytList.length].id);
    } else if (ambient) {
      const idx = AMBIENTS.findIndex((a) => a.key === ambient);
      pickAmbient(AMBIENTS[(idx + 1) % AMBIENTS.length].key);
    } else {
      pickAmbient(AMBIENTS[0].key);
    }
  };
  useEffect(() => { if (masterRef.current) masterRef.current.gain.value = volume * 0.12; }, [volume]);

  /* YouTube */
  const saveYt = (list: YtItem[]) => { setYtList(list); localStorage.setItem(YT_KEY, JSON.stringify(list)); };
  const addYt = () => {
    const id = parseYtId(ytUrl);
    if (!id) return;
    saveYt([...ytList.filter((x) => x.id !== id), { id, title: `Мой трек · ${ytList.length + 1}` }]);
    setYtUrl('');
  };
  const playYt = (id: string) => { pickAmbient(null); setSoundPaused(false); setYtActive(id); };

  /* Обои */
  const applyWallpaper = (src: string) => {
    setWallpaper(src);
    try { localStorage.setItem(WP_KEY, src); } catch {}
  };
  const uploadWallpaper = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => applyWallpaper(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  /* Fullscreen */
  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) { await document.exitFullscreen(); setFullscreen(false); }
      else { await document.documentElement.requestFullscreen(); setFullscreen(true); }
    } catch {}
  };

  const close = () => { stop(); stopSound(); onClose(); };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === ' ' && (e.target as HTMLElement)?.tagName !== 'INPUT') { e.preventDefault(); running ? pause() : start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running]);

  if (!open) return null;

  const total = duration * 60;
  const pct = total ? (total - secondsLeft) / total : 0;
  const R = 138;
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[200] text-white select-none overflow-y-auto bg-[#0b0a14]">
      {/* Обои + затемнение */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${wallpaper})` }} />
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
        <button onClick={close} className={`flex items-center gap-2 ${glass} px-3 py-2 text-sm text-white/70 hover:text-white transition-colors`}>
          <Square className="h-3.5 w-3.5 text-red-400" /> Завершить сессию
        </button>
      </div>

      {/* 3 колонки */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[300px_1fr_320px] gap-6 px-6 py-8 max-w-[1500px] mx-auto items-start min-h-[calc(100vh-84px)]">
        {/* ЛЕВО */}
        <div className="order-2 lg:order-1 flex flex-col gap-4 lg:min-h-[70vh]">
          <div className={`${glass} p-5`}>
            <div className="text-sm font-semibold mb-4">Цели фокус-сессии</div>
            {sessionTasks.length === 0 && <div className="text-sm text-white/40">Нет задач на сегодня</div>}
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
            <div className="mt-5 pt-4 border-t border-white/[0.08]">
              <div className="flex justify-between text-xs text-white/50 mb-2">
                <span>Прогресс сессии</span>
                <span className="tabular-nums">{doneCount} из {sessionTasks.length}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full rounded-full bg-white/80 transition-[width] duration-500" style={{ width: `${sessionPct}%` }} />
              </div>
              <div className="text-xl font-bold tabular-nums mt-2">{sessionPct}%</div>
            </div>
          </div>

          {/* Случайная цитата — по центру */}
          <div className={`${glass} p-6 flex-1 flex flex-col items-center justify-center text-center`}>
            <p className="text-sm text-white/60 leading-relaxed max-w-[220px]">«{quote.text}»</p>
            <p className="text-xs text-white/30 mt-3">— {quote.author}</p>
          </div>

          {/* Статистика фокуса — слева внизу, раскрывается по клику */}
          <div className={`${glass} overflow-hidden`}>
            <button onClick={() => setStatsOpen((v) => !v)} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-white/70 hover:text-white transition-colors">
              <BarChart3 className="h-4 w-4" /> Статистика фокуса
            </button>
            {statsOpen && (
              <div className="px-4 pb-4 grid grid-cols-2 gap-3 text-sm">
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
            )}
          </div>
        </div>

        {/* ЦЕНТР */}
        <div className="flex flex-col items-center gap-6 order-1 lg:order-2">
          <div className="relative">
            <svg width="320" height="320">
              {/* часовые деления */}
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
                  stroke="rgba(255,255,255,0.92)" strokeWidth="5" fill="none"
                  strokeDasharray={2 * Math.PI * R}
                  strokeDashoffset={(1 - pct) * 2 * Math.PI * R}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }}
                />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Интенсивность — в круге, кликабельна (авто от приоритета задачи) */}
              <button onClick={cycleIntensity} className={`${glass} !rounded-full px-3.5 py-1 text-xs text-white/75 hover:text-white transition-colors mb-3`} title="Интенсивность сессии — клик меняет">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/80 mr-1.5 align-middle" />
                {INTENSITY.find((x) => x.key === intensity)!.label}
              </button>
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
                <button onClick={() => { stop(); setSecondsLeft(duration * 60); }} className="h-10 w-10 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/60 hover:text-white transition-colors" title="Сброс таймера">
                  <Square className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Выбранная задача под кругом */}
          <div className="text-center min-h-[64px]">
            <div className="text-[11px] uppercase tracking-widest text-white/35 mb-1.5">Текущая задача</div>
            {currentTask ? (
              <div className="flex items-center justify-center gap-2 max-w-md">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PRIORITY_COLOR[currentTask.priority] ?? '#64748b' }} title={`Приоритет ${currentTask.priority}`} />
                <span className="text-xl font-semibold leading-snug">{currentTask.title}</span>
              </div>
            ) : (
              <div className="text-sm text-white/35">Свободный фокус — выбери задачу слева или просто работай</div>
            )}
          </div>

          {/* Панель управления: пресеты + звук + обои */}
          <div className={`flex items-center gap-1.5 ${glass} p-2`}>
            <button onClick={() => setYtOpen((v) => !v)} className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${ytOpen || ytActive ? 'text-red-300 bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'}`} title="YouTube для фокуса">
              <Youtube className="h-4.5 w-4.5" />
            </button>
            <span className="h-6 w-px bg-white/10" />
            {PRESETS.map((m) => (
              <button
                key={m}
                onClick={() => setDuration(m)}
                disabled={running}
                className={`h-10 w-10 rounded-full text-sm font-semibold transition-all disabled:opacity-40 ${
                  duration === m ? 'ring-1 ring-white/70 text-white bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'
                }`}
              >{m}</button>
            ))}
            <span className="h-6 w-px bg-white/10" />
            {/* управление звуком */}
            <button onClick={toggleSoundPause} disabled={!ambient && !ytActive} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30" title={soundPaused ? 'Продолжить звук' : 'Пауза звука'}>
              {soundPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => { stopSound(); setYtActive(null); }} disabled={!ambient && !ytActive} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30" title="Стоп звук">
              <VolumeX className="h-4 w-4" />
            </button>
            <button onClick={nextSound} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors" title="Следующий звук / трек">
              <SkipForward className="h-4 w-4" />
            </button>
            <span className="h-6 w-px bg-white/10" />
            {/* смена фона */}
            <button onClick={() => setWpOpen((v) => !v)} className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${wpOpen ? 'text-white bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'}`} title="Сменить фон">
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Выбор обоев */}
          {wpOpen && (
            <div className={`${glass} p-3 flex items-center gap-2 flex-wrap max-w-lg justify-center`}>
              {WALLPAPERS.map((w) => (
                <button key={w} onClick={() => applyWallpaper(w)} className={`h-12 w-20 rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${wallpaper === w ? 'border-white/90' : 'border-transparent opacity-70 hover:opacity-100'}`}>
                  <img src={w} alt="" className="h-full w-full object-cover" loading="lazy" />
                </button>
              ))}
              <button onClick={() => fileRef.current?.click()} className="h-12 w-20 rounded-lg border-2 border-dashed border-white/25 hover:border-white/60 flex flex-col items-center justify-center text-white/40 hover:text-white transition-colors" title="Загрузить свой фон">
                <Upload className="h-4 w-4" />
                <span className="text-[9px] mt-0.5">Свой</span>
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadWallpaper} />
            </div>
          )}

          <div className="text-xs text-white/35">Длительность фокуса: {duration} мин · Пробел — старт/пауза</div>
        </div>

        {/* ПРАВО */}
        <div className="space-y-4 order-3">
          {/* Отвлечения */}
          <div className={`${glass} p-5`}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Lock className="h-4 w-4 text-emerald-300" /> Отвлечения заблокированы
            </div>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 cursor-pointer group">
                <BellOff className="h-4 w-4 text-white/40" />
                <span className="flex-1 text-sm text-white/70 group-hover:text-white transition-colors">Уведомления приложения</span>
                <button
                  onClick={() => setBlockNotifs((v) => !v)}
                  className={`h-5 w-9 rounded-full transition-colors relative ${blockNotifs ? 'bg-emerald-400/80' : 'bg-white/15'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${blockNotifs ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
              <label className="flex items-center gap-3 cursor-pointer group">
                <Maximize className="h-4 w-4 text-white/40" />
                <span className="flex-1 text-sm text-white/70 group-hover:text-white transition-colors">Полноэкранный режим</span>
                <button
                  onClick={toggleFullscreen}
                  className={`h-5 w-9 rounded-full transition-colors relative ${fullscreen ? 'bg-emerald-400/80' : 'bg-white/15'}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${fullscreen ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </button>
              </label>
            </div>
            <p className="text-[11px] text-white/25 mt-3 leading-relaxed">Браузер не может блокировать другие приложения — включи «Не беспокоить» в системе для полного эффекта.</p>
          </div>

          {/* Звук */}
          <div className={`${glass} p-5`}>
            <div className="text-sm font-semibold mb-3">Фоновый звук</div>
            <div className="grid grid-cols-2 gap-2">
              {AMBIENTS.map((a) => (
                <button
                  key={a.key}
                  onClick={() => pickAmbient(a.key)}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-all active:scale-[0.97] ${
                    ambient === a.key ? 'border-white/60 bg-white/10 text-white' : 'border-white/[0.08] bg-white/[0.03] text-white/60 hover:text-white hover:bg-white/[0.07]'
                  }`}
                >
                  <a.icon className="h-4 w-4" /> {a.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3 mt-4">
              <Volume2 className="h-4 w-4 text-white/40 shrink-0" />
              <input
                type="range" min="0" max="1" step="0.05" value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          </div>

          {/* YouTube */}
          {(ytOpen || ytActive) && (
            <div className={`${glass} p-5`}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                <Youtube className="h-4 w-4 text-red-300" /> Focus-видео
              </div>
              {ytActive && (
                <div className="rounded-lg overflow-hidden mb-3 aspect-video bg-black">
                  <iframe
                    width="100%" height="100%"
                    src={`https://www.youtube-nocookie.com/embed/${ytActive}?autoplay=1&rel=0`}
                    title="Focus video"
                    frameBorder="0"
                    allow="autoplay; encrypted-media; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              <ul className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                {ytList.map((v) => (
                  <li key={v.id} className="group flex items-center gap-2">
                    <button
                      onClick={() => playYt(v.id)}
                      className={`flex-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${ytActive === v.id ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/[0.06]'}`}
                    >
                      <img src={`https://i.ytimg.com/vi/${v.id}/default.jpg`} alt="" className="h-8 w-12 rounded object-cover shrink-0" loading="lazy" />
                      <span className="truncate">{v.title}</span>
                    </button>
                    <button onClick={() => saveYt(ytList.filter((x) => x.id !== v.id))} className="opacity-0 group-hover:opacity-100 text-white/30 hover:text-red-400 transition-opacity shrink-0">
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
