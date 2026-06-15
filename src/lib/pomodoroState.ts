import { create } from 'zustand';

interface PomodoroState {
  running: boolean;
  phase: 'work' | 'rest';
  secondsLeft: number;
  taskTitle: string | null;
  pauseAction: (() => void) | null;
  resumeAction: (() => void) | null;
  stopAction: (() => void) | null;
  set: (s: Partial<Omit<PomodoroState, 'set'>>) => void;
}

export const usePomodoroState = create<PomodoroState>((set) => ({
  running: false,
  phase: 'work',
  secondsLeft: 0,
  taskTitle: null,
  pauseAction: null,
  resumeAction: null,
  stopAction: null,
  set: (s) => set(s),
}));

export function fmtSec(s: number): string {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
