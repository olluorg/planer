import { create } from 'zustand';

// Combo: 3 task-completions within 30 min → next 30 min XP ×1.5

const HISTORY_KEY = 'combo.completions.v1';
const WINDOW_MS = 30 * 60 * 1000;
const TRIGGER_COUNT = 3;
const BOOST_DURATION = 30 * 60 * 1000;
const MULTIPLIER = 1.5;

interface ComboState {
  multiplier: number;
  activeUntil: number | null;
  recordCompletion: () => void;
  refresh: () => void;
}

function loadHistory(): number[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const arr = raw ? JSON.parse(raw) as number[] : [];
    const now = Date.now();
    return arr.filter((t) => now - t < WINDOW_MS);
  } catch { return []; }
}

function saveHistory(arr: number[]) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(arr));
}

function loadBoost(): number | null {
  try {
    const raw = localStorage.getItem('combo.boost.until.v1');
    if (!raw) return null;
    const ts = Number(raw);
    if (ts <= Date.now()) return null;
    return ts;
  } catch { return null; }
}

function saveBoost(ts: number | null) {
  if (ts === null) localStorage.removeItem('combo.boost.until.v1');
  else localStorage.setItem('combo.boost.until.v1', String(ts));
}

export const useCombo = create<ComboState>((set, get) => ({
  multiplier: loadBoost() !== null ? MULTIPLIER : 1,
  activeUntil: loadBoost(),

  recordCompletion: () => {
    const now = Date.now();
    const hist = [...loadHistory(), now].filter((t) => now - t < WINDOW_MS);
    saveHistory(hist);
    if (hist.length >= TRIGGER_COUNT && get().activeUntil === null) {
      const until = now + BOOST_DURATION;
      saveBoost(until);
      set({ multiplier: MULTIPLIER, activeUntil: until });
      try {
        const prev = Number(localStorage.getItem('combo.lifetime.count.v1') || 0);
        localStorage.setItem('combo.lifetime.count.v1', String(prev + 1));
      } catch {}
      try {
        new Notification('THEDAD', { body: 'Поток! ×1.5 XP на 30 минут. Не теряй темп.' });
      } catch {}
    }
  },

  refresh: () => {
    const until = loadBoost();
    if (until === null && get().activeUntil !== null) {
      set({ multiplier: 1, activeUntil: null });
    } else if (until !== null && get().activeUntil !== until) {
      set({ multiplier: MULTIPLIER, activeUntil: until });
    }
  },
}));
