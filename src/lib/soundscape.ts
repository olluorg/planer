import { create } from 'zustand';
import {
  CloudRain, Waves, CloudLightning, Wind, FlameKindling, TreePine, MoonStar, Volume2,
} from 'lucide-react';

/**
 * Глобальный «звуковой ландшафт»: генеративные слои (WebAudio) живут в модуле-синглтоне,
 * а не в компоненте Focus Mode — поэтому звук не прерывается при выходе из фокуса.
 * Управлять можно из фокуса и из виджета «Атмосфера». Состояние — в zustand для UI.
 */

export type LayerKey = 'rain' | 'ocean' | 'white' | 'forest' | 'thunder' | 'wind' | 'fire' | 'night';

export const LAYERS: { key: LayerKey; label: string; icon: React.ElementType }[] = [
  { key: 'rain', label: 'Дождь', icon: CloudRain },
  { key: 'ocean', label: 'Океан', icon: Waves },
  { key: 'thunder', label: 'Гром', icon: CloudLightning },
  { key: 'wind', label: 'Ветер', icon: Wind },
  { key: 'fire', label: 'Костёр', icon: FlameKindling },
  { key: 'forest', label: 'Ручей', icon: TreePine },
  { key: 'night', label: 'Сверчки', icon: MoonStar },
  { key: 'white', label: 'Белый шум', icon: Volume2 },
];

export const MIX_PRESETS: { label: string; mix: Partial<Record<LayerKey, number>> }[] = [
  { label: 'Шторм', mix: { thunder: 0.8, wind: 0.55, rain: 0.7, ocean: 0.35 } },
  { label: 'Лес ночью', mix: { forest: 0.6, night: 0.5, wind: 0.25 } },
  { label: 'У камина', mix: { fire: 0.85, rain: 0.3, wind: 0.15 } },
  { label: 'Дождь у окна', mix: { rain: 0.8, thunder: 0.25 } },
];

/* ==================== Генерация шума ==================== */

function noiseBuffer(ctx: AudioContext, kind: 'white' | 'brown' | 'crackle'): AudioBuffer {
  const size = 2 * ctx.sampleRate;
  const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  if (kind === 'crackle') {
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

/* ==================== Синглтон-движок ==================== */

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
const running = new Map<LayerKey, { gain: GainNode; stop: () => void }>();

function ensure(): { ctx: AudioContext; master: GainNode } {
  if (!ctx) {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
    ctx = new Ctx();
    masterGain = ctx.createGain();
    masterGain.gain.value = useSoundscape.getState().master * 0.2;
    masterGain.connect(ctx.destination);
  }
  return { ctx: ctx!, master: masterGain! };
}

// Персист микса — какие слои играли (звук должен переживать перезагрузку страницы)
const MIX_KEY = 'soundscape.mix.v1';
function loadMix(): Partial<Record<LayerKey, number>> {
  try { return JSON.parse(localStorage.getItem(MIX_KEY) || '{}'); } catch { return {}; }
}
function saveMix(m: Partial<Record<LayerKey, number>>) {
  try { localStorage.setItem(MIX_KEY, JSON.stringify(m)); } catch {}
}

interface SoundState {
  mix: Partial<Record<LayerKey, number>>;
  master: number;
  paused: boolean;
  setLayer: (key: LayerKey, vol: number) => void;
  applyPreset: (mix: Partial<Record<LayerKey, number>>) => void;
  stopAll: () => void;
  setMaster: (v: number) => void;
  togglePause: () => void;
  anyActive: () => boolean;
  /** Запустить сохранённые слои заново (после перезагрузки — только по пользовательскому жесту). */
  resumeAudio: () => void;
}

export const useSoundscape = create<SoundState>((set, get) => ({
  // восстанавливаем СОСТОЯНИЕ микса сразу (UI показывает активные слои); сам звук стартует по жесту
  mix: loadMix(),
  master: Number(localStorage.getItem('soundscape.master') || '0.6'),
  paused: false,

  setLayer: (key, vol) => {
    const next = { ...get().mix, [key]: vol };
    if (vol <= 0) delete next[key];
    set({ mix: next });
    saveMix(next);
    try {
      const { ctx, master } = ensure();
      void ctx.resume();
      set({ paused: false });
      const existing = running.get(key);
      if (vol <= 0) {
        if (existing) { existing.stop(); existing.gain.disconnect(); running.delete(key); }
        return;
      }
      if (existing) existing.gain.gain.setTargetAtTime(vol, ctx.currentTime, 0.05);
      else {
        const g = ctx.createGain();
        g.gain.value = vol;
        g.connect(master);
        running.set(key, { gain: g, stop: startLayer(ctx, key, g) });
      }
    } catch {}
  },

  applyPreset: (preset) => {
    LAYERS.forEach((l) => {
      const v = preset[l.key] ?? 0;
      if ((get().mix[l.key] ?? 0) !== v) get().setLayer(l.key, v);
    });
  },

  stopAll: () => {
    running.forEach((l) => { l.stop(); l.gain.disconnect(); });
    running.clear();
    set({ mix: {}, paused: false });
    saveMix({});
  },

  setMaster: (v) => {
    set({ master: v });
    try { localStorage.setItem('soundscape.master', String(v)); } catch {}
    if (masterGain) masterGain.gain.value = v * 0.2;
  },

  togglePause: () => {
    if (!ctx || Object.keys(get().mix).length === 0) return;
    if (get().paused) { void ctx.resume(); set({ paused: false }); }
    else { void ctx.suspend(); set({ paused: true }); }
  },

  anyActive: () => Object.keys(get().mix).length > 0,

  resumeAudio: () => {
    const m = get().mix;
    Object.entries(m).forEach(([k, v]) => { if (v && v > 0) get().setLayer(k as LayerKey, v); });
  },
}));

// После перезагрузки браузер запускает аудио только по пользовательскому жесту — если был
// сохранён микс, стартуем слои при первом клике/нажатии, один раз.
if (typeof window !== 'undefined' && Object.keys(loadMix()).length > 0) {
  const resume = () => {
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
    const st = useSoundscape.getState();
    if (Object.keys(st.mix).length > 0) st.resumeAudio();
  };
  window.addEventListener('pointerdown', resume, { once: false });
  window.addEventListener('keydown', resume, { once: false });
}
