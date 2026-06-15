const ENABLED_KEY = 'thedad.sound.enabled.v1';

let ctx: AudioContext | null = null;

function ensureCtx(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window || 'webkitAudioContext' in (window as any))) return null;
  if (!ctx) {
    try {
      const Ctor = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
      ctx = new Ctor();
    } catch { return null; }
  }
  return ctx;
}

export function isSoundEnabled(): boolean {
  return localStorage.getItem(ENABLED_KEY) === '1';
}
export function setSoundEnabled(v: boolean) {
  localStorage.setItem(ENABLED_KEY, v ? '1' : '0');
}

export function playBeep(opts: { freq?: number; duration?: number; type?: OscillatorType; gain?: number } = {}) {
  if (!isSoundEnabled()) return;
  const c = ensureCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  const now = c.currentTime;
  const dur = (opts.duration ?? 0.12);
  const gain = opts.gain ?? 0.08;
  o.type = opts.type ?? 'sine';
  o.frequency.setValueAtTime(opts.freq ?? 660, now);
  g.gain.setValueAtTime(0, now);
  g.gain.linearRampToValueAtTime(gain, now + 0.01);
  g.gain.linearRampToValueAtTime(0, now + dur);
  o.connect(g).connect(c.destination);
  o.start(now);
  o.stop(now + dur + 0.02);
}

export function playSuccess() {
  if (!isSoundEnabled()) return;
  playBeep({ freq: 660, duration: 0.1 });
  setTimeout(() => playBeep({ freq: 880, duration: 0.12 }), 100);
}

export function playUnlock() {
  if (!isSoundEnabled()) return;
  playBeep({ freq: 523, duration: 0.12 });
  setTimeout(() => playBeep({ freq: 659, duration: 0.12 }), 110);
  setTimeout(() => playBeep({ freq: 784, duration: 0.18 }), 220);
}
