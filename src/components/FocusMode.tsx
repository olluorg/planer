import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { usePomodoroState, fmtSec } from '@/lib/pomodoroState';
import { isoDate } from '@/lib/utils';
import { compressImage } from '@/lib/imageCompress';
import { getCustomWallpapers, addCustomWallpaper, removeCustomWallpaper } from '@/lib/theme';
import { QUOTES, quoteOfDay } from '@/lib/quotes';
import {
  X, Pause, Play, Square, SkipForward, Volume2, VolumeX, Youtube, Plus, Trash2,
  CheckCircle2, Flame, Waves, CloudRain, Wind, TreePine, Image as ImageIcon,
  Lock, BellOff, Maximize, BarChart3, Upload, CloudLightning, FlameKindling, MoonStar,
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

/* ==================== Звуковой микшер (WebAudio, всё генеративное) ==================== */

type LayerKey = 'rain' | 'ocean' | 'white' | 'forest' | 'thunder' | 'wind' | 'fire' | 'night';

const LAYERS: { key: LayerKey; label: string; icon: React.ElementType }[] = [
  { key: 'rain', label: 'Дождь', icon: CloudRain },
  { key: 'ocean', label: 'Океан', icon: Waves },
  { key: 'thunder', label: 'Гром', icon: CloudLightning },
  { key: 'wind', label: 'Ветер', icon: Wind },
  { key: 'fire', label: 'Костёр', icon: FlameKindling },
  { key: 'forest', label: 'Ручей', icon: TreePine },
  { key: 'night', label: 'Сверчки', icon: MoonStar },
  { key: 'white', label: 'Белый шум', icon: Volume2 },
];

/* Пресеты миксов — как в lofi-приложениях */
const MIX_PRESETS: { label: string; mix: Partial<Record<LayerKey, number>> }[] = [
  { label: 'Шторм', mix: { thunder: 0.8, wind: 0.55, rain: 0.7, ocean: 0.35 } },
  { label: 'Лес ночью', mix: { forest: 0.6, night: 0.5, wind: 0.25 } },
  { label: 'У камина', mix: { fire: 0.85, rain: 0.3, wind: 0.15 } },
  { label: 'Дождь у окна', mix: { rain: 0.8, thunder: 0.25 } },
];

function noiseBuffer(ctx: AudioContext, kind: 'white' | 'brown' | 'crackle'): AudioBuffer {
  const size = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  if (kind === 'crackle') {
    // редкие щелчки с экспоненциальным хвостом — треск костра
    let env = 0;
    for (let i = 0; i < size; i++) {
      if (Math.random() < 0.0012) env = Math.random() * 0.9 + 0.1;
      env *= 0.986;
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }
  for (let i = 0; i < size; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === 'brown') {
      data[i] = (last + 0.02 * white) / 1.02;
      last = data[i];
      data[i] *= 3.5;
    } else {
      data[i] = white;
    }
  }
  return buffer;
}

/** Запускает слой; выход подключается к переданному gain (громкость слоя). Возвращает stop(). */
function startLayer(ctx: AudioContext, key: LayerKey, out: GainNode): () => void {
  const cleanups: (() => void)[] = [];
  const mkSrc = (kind: 'white' | 'brown' | 'crackle') => {
    const s = ctx.createBufferSource();
    s.buffer = noiseBuffer(ctx, kind);
    s.loop = true;
    cleanups.push(() => { try { s.stop(); } catch {} s.disconnect(); });
    return s;
  };
  const mkNode = <T extends AudioNode>(n: T): T => { cleanups.push(() => { try { n.disconnect(); (n as any).stop?.(); } catch {} }); return n; };

  switch (key) {
    case 'rain': {
      const src = mkSrc('white');
      const lp = mkNode(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
      src.connect(lp).connect(out); src.start();
      break;
    }
    case 'ocean': {
      const src = mkSrc('brown');
      const g = mkNode(ctx.createGain()); g.gain.value = 0.7;
      const lfo = mkNode(ctx.createOscillator()); lfo.frequency.value = 0.07;
      const lg = mkNode(ctx.createGain()); lg.gain.value = 0.3;
      lfo.connect(lg).connect(g.gain); lfo.start();
      src.connect(g).connect(out); src.start();
      break;
    }
    case 'white': {
      const src = mkSrc('white');
      const hs = mkNode(ctx.createBiquadFilter()); hs.type = 'highshelf'; hs.frequency.value = 4000; hs.gain.value = -10;
      src.connect(hs).connect(out); src.start();
      break;
    }
    case 'forest': {
      const src = mkSrc('white');
      const bp = mkNode(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 2400; bp.Q.value = 0.4;
      const lp = mkNode(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 5000;
      src.connect(bp); bp.connect(lp); lp.connect(out); src.start();
      break;
    }
    case 'wind': {
      const src = mkSrc('white');
      const bp = mkNode(ctx.createBiquadFilter()); bp.type = 'bandpass'; bp.frequency.value = 480; bp.Q.value = 0.7;
      const g = mkNode(ctx.createGain()); g.gain.value = 0.75;
      // порывы: LFO на частоту фильтра и громкость
      const lfoF = mkNode(ctx.createOscillator()); lfoF.frequency.value = 0.11;
      const lfoFG = mkNode(ctx.createGain()); lfoFG.gain.value = 220;
      lfoF.connect(lfoFG).connect(bp.frequency); lfoF.start();
      const lfoA = mkNode(ctx.createOscillator()); lfoA.frequency.value = 0.05;
      const lfoAG = mkNode(ctx.createGain()); lfoAG.gain.value = 0.25;
      lfoA.connect(lfoAG).connect(g.gain); lfoA.start();
      src.connect(bp).connect(g).connect(out); src.start();
      break;
    }
    case 'fire': {
      const src = mkSrc('crackle');
      const lp = mkNode(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 3200;
      const base = mkSrc('brown');
      const baseLp = mkNode(ctx.createBiquadFilter()); baseLp.type = 'lowpass'; baseLp.frequency.value = 220;
      const baseG = mkNode(ctx.createGain()); baseG.gain.value = 0.25;
      src.connect(lp).connect(out); src.start();
      base.connect(baseLp).connect(baseG).connect(out); base.start();
      break;
    }
    case 'thunder': {
      // раскаты: brown → lowpass, громкость по конверту случайными интервалами
      const src = mkSrc('brown');
      const lp = mkNode(ctx.createBiquadFilter()); lp.type = 'lowpass'; lp.frequency.value = 140;
      const g = mkNode(ctx.createGain()); g.gain.value = 0;
      src.connect(lp).connect(g).connect(out); src.start();
      let timer = 0;
      const roll = () => {
        const t = ctx.currentTime;
        const peak = 0.6 + Math.random() * 0.6;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.25 + Math.random() * 0.6);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.5 + Math.random() * 3);
        timer = window.setTimeout(roll, 6000 + Math.random() * 14000);
      };
      timer = window.setTimeout(roll, 800 + Math.random() * 2000);
      cleanups.push(() => window.clearTimeout(timer));
      break;
    }
    case 'night': {
      // сверчки: тон ~4.3кГц, стрекот AM 22Гц + фразы 1.1Гц
      const osc = mkNode(ctx.createOscillator()); osc.type = 'sine'; osc.frequency.value = 4300;
      const chirp = mkNode(ctx.createGain()); chirp.gain.value = 0;
      const lfo1 = mkNode(ctx.createOscillator()); lfo1.type = 'square'; lfo1.frequency.value = 22;
      const lfo1g = mkNode(ctx.createGain()); lfo1g.gain.value = 0.5;
      lfo1.connect(lfo1g).connect(chirp.gain); lfo1.start();
      const phrase = mkNode(ctx.createGain()); phrase.gain.value = 0;
      const lfo2 = mkNode(ctx.createOscillator()); lfo2.type = 'square'; lfo2.frequency.value = 1.1;
      const lfo2g = mkNode(ctx.createGain()); lfo2g.gain.value = 0.5;
      lfo2.connect(lfo2g).connect(phrase.gain); lfo2.start();
      const soft = mkNode(ctx.createGain()); soft.gain.value = 0.16;
      osc.connect(chirp).connect(phrase).connect(soft).connect(out); osc.start();
      break;
    }
  }
  return () => cleanups.forEach((fn) => fn());
}

/* ==================== YouTube ==================== */

interface YtItem { id: string; title: string }

const YT_KEY = 'focus.youtube.v2';
const YT_DEFAULTS: YtItem[] = [
  { id: 'PB8ZrGinWi0', title: 'Focus music · 1' },
  { id: 'X4VbdwhkE10', title: 'Focus music · 2' },
  { id: 'qwosU7e9mqc', title: 'Focus music · 3' },
  { id: 'LEEx_UkHmBU', title: 'Focus music · 4' },
  { id: '68ahXMmMorg', title: 'Skyrim · Ambience' },
  { id: 'YKJ-fkbMOOg', title: 'Focus music · 6' },
];

function loadYt(): YtItem[] {
  try {
    // v1 → v2 миграция: докидываем новые дефолты, свои треки сохраняем
    const raw = localStorage.getItem(YT_KEY) ?? localStorage.getItem('focus.youtube.v1');
    if (raw) {
      const saved: YtItem[] = JSON.parse(raw);
      const merged = [...saved, ...YT_DEFAULTS.filter((d) => !saved.some((s) => s.id === d.id))];
      return merged;
    }
  } catch {}
  return YT_DEFAULTS;
}

function parseYtId(url: string): string | null {
  const m = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  return m ? m[1] : (/^[\w-]{11}$/.test(url.trim()) ? url.trim() : null);
}

/* ==================== Обои ==================== */

const WALLPAPERS = Array.from({ length: 12 }, (_, i) => `/wallpapers/wp${i + 1}.jpg`);
const WP_KEY = 'focus.wallpaper.v1';

const glass = 'rounded-xl bg-white/[0.05] backdrop-blur-2xl border border-white/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.35)]';

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
  onClose: () => void;
}

export const FocusMode: React.FC<Props> = ({ open, onClose }) => {
  const { tasks, timeEntries, toggleTask, addTask, startTimeEntry, finishTimeEntry } = useStore();
  const setGlobal = usePomodoroState((s) => s.set);

  const [duration, setDuration] = useState(90);
  const [secondsLeft, setSecondsLeft] = useState(90 * 60);
  const [running, setRunning] = useState(false);
  const tickRef = useRef<number | null>(null);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [intensityManual, setIntensityManual] = useState<IntensityKey | null>(null);
  const [newTask, setNewTask] = useState('');

  // Микшер: громкость каждого слоя 0..1 (0 = выключен)
  const [mix, setMix] = useState<Partial<Record<LayerKey, number>>>({});
  const [soundPaused, setSoundPaused] = useState(false);
  const [master, setMaster] = useState(0.6);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const layersRef = useRef<Map<LayerKey, { gain: GainNode; stop: () => void }>>(new Map());

  // YouTube — панель открыта по умолчанию
  const [ytOpen, setYtOpen] = useState(true);
  const [ytList, setYtList] = useState<YtItem[]>(loadYt);
  const [ytActive, setYtActive] = useState<string | null>(null);
  const [ytVolume, setYtVolume] = useState(70);
  const [ytUrl, setYtUrl] = useState('');
  const ytFrameRef = useRef<HTMLIFrameElement>(null);

  const [wallpaper, setWallpaper] = useState<string>(() => localStorage.getItem(WP_KEY) || WALLPAPERS[0]);
  const [customWp, setCustomWp] = useState<string[]>(getCustomWallpapers);
  const [wpOpen, setWpOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [blockNotifs, setBlockNotifs] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
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

  const quote = useMemo(() => (open ? QUOTES[Math.floor(Math.random() * QUOTES.length)] : quoteOfDay()), [open]);

  const today = isoDate(new Date());
  const sessionTasks = useMemo(
    () => tasks.filter((t) => t.date === today && !t.parent_id).sort((a, b) => (a.status === b.status ? a.priority - b.priority : a.status === 'done' ? 1 : -1)).slice(0, 7),
    [tasks, today],
  );
  const doneCount = sessionTasks.filter((t) => t.status === 'done').length;
  const sessionPct = sessionTasks.length ? Math.round((doneCount / sessionTasks.length) * 100) : 0;
  const currentTask = selectedId ? sessionTasks.find((t) => t.id === selectedId) ?? null : null;

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
      stopAllSound();
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
  const complete = () => {
    setRunning(false);
    setZen(false);
    if (entryRef.current) {
      finishTimeEntry(entryRef.current, duration * 60);
      entryRef.current = null;
    }
    if (!blockNotifs) { try { new Notification('Focus Mode', { body: `Сессия ${duration} мин завершена 🎉` }); } catch {} }
  };

  /* ===== Микшер ===== */
  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      ctxRef.current = new Ctx();
      masterRef.current = ctxRef.current.createGain();
      masterRef.current.gain.value = master * 0.2;
      masterRef.current.connect(ctxRef.current.destination);
    }
    return { ctx: ctxRef.current!, masterG: masterRef.current! };
  };

  const setLayer = (key: LayerKey, vol: number) => {
    const next = { ...mix, [key]: vol };
    if (vol <= 0) delete next[key];
    setMix(next);
    try {
      const { ctx, masterG } = ensureCtx();
      void ctx.resume();
      setSoundPaused(false);
      const existing = layersRef.current.get(key);
      if (vol <= 0) {
        if (existing) { existing.stop(); existing.gain.disconnect(); layersRef.current.delete(key); }
        return;
      }
      if (existing) {
        existing.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
      } else {
        const g = ctx.createGain();
        g.gain.value = vol;
        g.connect(masterG);
        const stopFn = startLayer(ctx, key, g);
        layersRef.current.set(key, { gain: g, stop: stopFn });
      }
    } catch {}
  };

  const applyMixPreset = (preset: Partial<Record<LayerKey, number>>) => {
    // выключаем всё, что не в пресете, ставим уровни из пресета
    LAYERS.forEach((l) => {
      const v = preset[l.key] ?? 0;
      if ((mix[l.key] ?? 0) !== v) setLayerRaw(l.key, v);
    });
    setMix({ ...preset });
  };
  // как setLayer, но без setMix (для пакетного применения пресета)
  const setLayerRaw = (key: LayerKey, vol: number) => {
    try {
      const { ctx, masterG } = ensureCtx();
      void ctx.resume();
      setSoundPaused(false);
      const existing = layersRef.current.get(key);
      if (vol <= 0) {
        if (existing) { existing.stop(); existing.gain.disconnect(); layersRef.current.delete(key); }
        return;
      }
      if (existing) existing.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
      else {
        const g = ctx.createGain();
        g.gain.value = vol;
        g.connect(masterG);
        layersRef.current.set(key, { gain: g, stop: startLayer(ctx, key, g) });
      }
    } catch {}
  };

  const stopAllSound = () => {
    layersRef.current.forEach((l) => { l.stop(); l.gain.disconnect(); });
    layersRef.current.clear();
    setMix({});
    setSoundPaused(false);
  };
  const anySound = Object.keys(mix).length > 0;

  const toggleSoundPause = () => {
    const ctx = ctxRef.current;
    if (!ctx || (!anySound && !ytActive)) return;
    if (soundPaused) { void ctx.resume(); setSoundPaused(false); }
    else { void ctx.suspend(); setSoundPaused(true); }
  };
  useEffect(() => { if (masterRef.current) masterRef.current.gain.value = master * 0.2; }, [master]);

  /* ===== YouTube ===== */
  const saveYt = (list: YtItem[]) => { setYtList(list); localStorage.setItem(YT_KEY, JSON.stringify(list)); };
  const addYt = () => {
    const id = parseYtId(ytUrl);
    if (!id) return;
    saveYt([...ytList.filter((x) => x.id !== id), { id, title: `Мой трек · ${ytList.length + 1}` }]);
    setYtUrl('');
  };
  const playYt = (id: string) => setYtActive(id);
  const nextYt = () => {
    if (!ytList.length) return;
    const idx = ytActive ? ytList.findIndex((x) => x.id === ytActive) : -1;
    setYtActive(ytList[(idx + 1) % ytList.length].id);
  };
  const ytCommand = (func: string, args: unknown[] = []) => {
    ytFrameRef.current?.contentWindow?.postMessage(JSON.stringify({ event: 'command', func, args }), '*');
  };
  const changeYtVolume = (v: number) => {
    setYtVolume(v);
    ytCommand('setVolume', [v]);
    if (v === 0) ytCommand('mute'); else ytCommand('unMute');
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
    if (wallpaper === src) applyWallpaper(WALLPAPERS[0]);
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

  const close = () => { stop(); stopAllSound(); onClose(); };

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

  const total = duration * 60;
  const pct = total ? (total - secondsLeft) / total : 0;
  const R = 138;
  const ticks = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="fixed inset-0 z-[200] text-white select-none overflow-y-auto bg-[#0b0a14]">
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

      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-[300px_1fr_330px] gap-6 px-6 py-8 max-w-[1520px] mx-auto items-start min-h-[calc(100vh-84px)]">
        {/* ЛЕВО */}
        <div className={`order-2 lg:order-1 flex flex-col gap-4 lg:min-h-[70vh] transition-[opacity,transform] duration-500 ease-out ${zen ? 'opacity-0 -translate-x-6 pointer-events-none' : ''}`}>
          <div className={`${glass} p-5`}>
            <div className="text-sm font-semibold mb-4">Цели фокус-сессии</div>
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
          </div>

          <div className={`${glass} p-6 flex-1 flex flex-col items-center justify-center text-center`}>
            <p className="text-sm text-white/60 leading-relaxed max-w-[220px]">«{quote.text}»</p>
            <p className="text-xs text-white/30 mt-3">— {quote.author}</p>
          </div>

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
                  stroke="rgba(255,255,255,0.92)" strokeWidth="5" fill="none"
                  strokeDasharray={2 * Math.PI * R}
                  strokeDashoffset={(1 - pct) * 2 * Math.PI * R}
                  strokeLinecap="round"
                  style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }}
                />
              </g>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
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

          {/* Панель управления */}
          <div className={`flex items-center gap-1.5 ${glass} p-2 flex-wrap justify-center`}>
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
            <button onClick={toggleSoundPause} disabled={!anySound && !ytActive} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30" title={soundPaused ? 'Продолжить звук' : 'Пауза звука'}>
              {soundPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
            <button onClick={() => { stopAllSound(); setYtActive(null); }} disabled={!anySound && !ytActive} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30" title="Стоп звук">
              <VolumeX className="h-4 w-4" />
            </button>
            <button onClick={nextYt} className="h-10 w-10 rounded-full flex items-center justify-center text-white/55 hover:text-white hover:bg-white/10 transition-colors" title="Следующий трек">
              <SkipForward className="h-4 w-4" />
            </button>
            <span className="h-6 w-px bg-white/10" />
            <button onClick={() => setWpOpen((v) => !v)} className={`h-10 w-10 rounded-full flex items-center justify-center transition-colors ${wpOpen ? 'text-white bg-white/10' : 'text-white/55 hover:text-white hover:bg-white/10'}`} title="Сменить фон">
              <ImageIcon className="h-4 w-4" />
            </button>
          </div>

          {wpOpen && (
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

          <div className="text-xs text-white/35">Длительность фокуса: {duration} мин · Пробел — старт/пауза</div>
        </div>


        {/* ПРАВО */}
        <div className={`space-y-4 order-3 transition-[opacity,transform] duration-500 ease-out ${zen ? 'opacity-0 translate-x-6 pointer-events-none' : ''}`}>
          {/* Отвлечения */}
          <div className={`${glass} p-5`}>
            <div className="flex items-center gap-2 text-sm font-semibold mb-3">
              <Lock className="h-4 w-4 text-emerald-300" /> Отвлечения заблокированы
            </div>
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

          {/* Микшер звуков */}
          <div className={`${glass} p-5`}>
            <div className="text-sm font-semibold mb-3">Звуковой микшер</div>
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
          </div>

          {/* YouTube — открыт по умолчанию */}
          {(ytOpen || ytActive) && (
            <div className={`${glass} p-5`}>
              <div className="flex items-center gap-2 text-sm font-semibold mb-3">
                <Youtube className="h-4 w-4 text-red-300" /> Focus-видео
              </div>
              {ytActive && (
                <>
                  <div className="rounded-lg overflow-hidden mb-2 aspect-video bg-black">
                    <iframe
                      ref={ytFrameRef}
                      width="100%" height="100%"
                      src={`https://www.youtube-nocookie.com/embed/${ytActive}?autoplay=1&rel=0&enablejsapi=1`}
                      title="Focus video"
                      frameBorder="0"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
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
