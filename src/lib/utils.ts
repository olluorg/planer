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

// Smooth color ramp: 0% red → 50% yellow → 100% green.
export function colorByPct(v: number): string {
  const x = clamp(v, 0, 100) / 100;
  // HSL: red 0°, yellow 50°, green 130°
  const hue = x * 130;
  const sat = 70;
  const light = 50;
  return `hsl(${Math.round(hue)} ${sat}% ${light}%)`;
}
