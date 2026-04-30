import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function pct(done: number, total: number): number {
  if (!total) return 0;
  return Math.round((done / total) * 100);
}

export function fmtNum(n: number, frac = 0): string {
  return n.toLocaleString('ru-RU', { maximumFractionDigits: frac });
}

// Strict 3-level system: <34% red, <70% yellow, ≥70% green.
export const STATE = {
  fail: '#ef4444',
  progress: '#eab308',
  done: '#22c55e',
} as const;

export type StateLevel = 'fail' | 'progress' | 'done';

export function levelByPct(v: number): StateLevel {
  const x = clamp(v, 0, 100);
  if (x >= 70) return 'done';
  if (x >= 34) return 'progress';
  return 'fail';
}

export function colorByPct(v: number): string {
  return STATE[levelByPct(v)];
}
