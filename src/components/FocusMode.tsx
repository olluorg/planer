import { useEffect, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { usePomodoroState, fmtSec } from '@/lib/pomodoroState';
import { X, Pause, Play, Square, Volume2, VolumeX, Music } from 'lucide-react';

const SESSIONS = [
  { min: 25, label: '25 мин' },
  { min: 45, label: '45 мин' },
  { min: 90, label: '90 мин' },
] as const;

// Очень тихий ambient — генерируем шум через WebAudio.
function makeBrownNoise(ctx: AudioContext, gain: number): { stop: () => void } {
  const bufferSize = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < bufferSize; i++) {
    const white = Math.random() * 2 - 1;
    data[i] = (lastOut + 0.02 * white) / 1.02;
    lastOut = data[i];
    data[i] *= 3.5;
  }
  const noise = ctx.createBufferSource();
  noise.buffer = buffer; noise.loop = true;
  const g = ctx.createGain();
  g.gain.value = gain;
  noise.connect(g).connect(ctx.destination);
  noise.start(0);
  return { stop: () => { try { noise.stop(); } catch {} g.disconnect(); } };
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export const FocusMode: React.FC<Props> = ({ open, onClose }) => {
  const startTimeEntry = useStore((s) => s.startTimeEntry);
  const finishTimeEntry = useStore((s) => s.finishTimeEntry);
  const setGlobal = usePomodoroState((s) => s.set);

  const [duration, setDuration] = useState(45);
  const [secondsLeft, setSecondsLeft] = useState(45 * 60);
  const [running, setRunning] = useState(false);
  const [sound, setSound] = useState(false);
  const tickRef = useRef<number | null>(null);
  const entryRef = useRef<string | null>(null);
  const elapsedRef = useRef(0);
  const noiseRef = useRef<{ stop: () => void } | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    if (open) {
      setSecondsLeft(duration * 60);
      setRunning(false);
      elapsedRef.current = 0;
    } else {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { setSecondsLeft(duration * 60); }, [duration]);

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

  // Sync to global state so Topbar timer чип отражает focus session.
  useEffect(() => {
    setGlobal({ running, phase: 'work', secondsLeft, taskTitle: 'Deep Work' });
    return () => setGlobal({ running: false, secondsLeft: 0, taskTitle: null });
  }, [running, secondsLeft, setGlobal]);

  const start = () => {
    if (!entryRef.current) {
      const e = startTimeEntry(null, 'pomodoro');
      entryRef.current = e.id;
      elapsedRef.current = 0;
    }
    setRunning(true);
    if (sound) startSound();
  };
  const pause = () => setRunning(false);
  const stop = () => {
    setRunning(false);
    if (entryRef.current) {
      finishTimeEntry(entryRef.current, elapsedRef.current);
      entryRef.current = null;
    }
    elapsedRef.current = 0;
    stopSound();
  };
  const complete = () => {
    setRunning(false);
    if (entryRef.current) {
      finishTimeEntry(entryRef.current, duration * 60);
      entryRef.current = null;
    }
    stopSound();
    try { new Notification('Deep Work', { body: `Сессия ${duration} мин завершена` }); } catch {}
  };

  const startSound = () => {
    if (noiseRef.current) return;
    try {
      const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      if (!ctxRef.current) ctxRef.current = new Ctx();
      noiseRef.current = makeBrownNoise(ctxRef.current, 0.05);
    } catch {}
  };
  const stopSound = () => {
    if (noiseRef.current) { noiseRef.current.stop(); noiseRef.current = null; }
  };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    if (next && running) startSound();
    if (!next) stopSound();
  };

  const close = () => { stop(); onClose(); };

  // Block escape/space shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key === ' ') { e.preventDefault(); running ? pause() : start(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, running]);

  if (!open) return null;

  const total = duration * 60;
  const pct = total ? (total - secondsLeft) / total : 0;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950 text-white flex flex-col items-center justify-center select-none">
      {/* Backdrop ambient */}
      <div
        className="absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(circle at 50% 40%, rgba(99,102,241,0.35), transparent 60%)',
        }}
      />

      <button onClick={close} className="absolute top-6 right-6 h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white">
        <X className="h-5 w-5" />
      </button>

      <div className="relative z-10 flex flex-col items-center gap-8">
        <div className="text-xs uppercase tracking-widest text-white/40">Deep Work</div>

        {/* Big ring */}
        <div className="relative">
          <svg width="320" height="320" className="-rotate-90">
            <circle cx="160" cy="160" r="148" stroke="rgba(255,255,255,0.06)" strokeWidth="6" fill="none" />
            <circle
              cx="160" cy="160" r="148"
              stroke="url(#fmgrad)" strokeWidth="6" fill="none"
              strokeDasharray={2 * Math.PI * 148}
              strokeDashoffset={(1 - pct) * 2 * Math.PI * 148}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 800ms cubic-bezier(0.4,0,0.2,1)' }}
            />
            <defs>
              <linearGradient id="fmgrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a78bfa" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-6xl font-bold tabular-nums">{fmtSec(secondsLeft)}</div>
            <div className="text-xs text-white/50 mt-2">{duration} мин · {running ? 'идёт' : 'пауза'}</div>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex gap-2">
          {SESSIONS.map((s) => (
            <button
              key={s.min}
              onClick={() => setDuration(s.min)}
              disabled={running}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                duration === s.min
                  ? 'bg-white/15 text-white'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              } disabled:opacity-40`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {!running ? (
            <button onClick={start} className="h-14 w-14 rounded-full bg-violet-500 hover:bg-violet-400 flex items-center justify-center shadow-lift">
              <Play className="h-6 w-6" fill="white" />
            </button>
          ) : (
            <button onClick={pause} className="h-14 w-14 rounded-full bg-white/15 hover:bg-white/25 flex items-center justify-center">
              <Pause className="h-6 w-6" />
            </button>
          )}
          <button onClick={stop} className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white">
            <Square className="h-4 w-4" />
          </button>
          <button onClick={toggleSound} className="h-10 w-10 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white" title="Ambient sound (коричневый шум)">
            {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs text-white/40">
          <Music className="h-3 w-3" />
          <span>Уведомления приостановлены · Esc — выйти · Пробел — пауза/старт</span>
        </div>
      </div>
    </div>
  );
};
