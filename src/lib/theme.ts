import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'glass';

const EVENT = 'reform-theme';
const ACCENT_EVENT = 'reform-accent';

export const ACCENTS = [
  { id: 'green',  label: 'Лайм',       color: '#84CC16', soft: '#A3E635' },
  { id: 'blue',   label: 'Синий',      color: '#3b82f6', soft: '#2563eb' },
  { id: 'purple', label: 'Лаванда',    color: '#6366f1', soft: '#818cf8' },
  { id: 'pink',   label: 'Розовый',    color: '#ec4899', soft: '#db2777' },
  { id: 'orange', label: 'Оранжевый',  color: '#f97316', soft: '#ea580c' },
  { id: 'cyan',   label: 'Бирюзовый',  color: '#06b6d4', soft: '#0891b2' },
] as const;

export type AccentId = typeof ACCENTS[number]['id'];

export function applyTheme(t: Theme) {
  localStorage.setItem('theme', t);
  // glass строится поверх тёмной палитры
  document.documentElement.classList.toggle('dark', t === 'dark' || t === 'glass');
  document.documentElement.classList.toggle('glass', t === 'glass');
  if (t === 'glass') applyAppWallpaper(getAppWallpaper());
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

/* Обои приложения (glass-тема): готовые из /wallpapers или свой dataURL */
const WP_KEY = 'app.wallpaper.v1';
export const APP_WALLPAPERS = ['/wallpapers/1.jpg', '/wallpapers/2.png', '/wallpapers/3.png', '/wallpapers/4.png', '/wallpapers/5.png', '/wallpapers/6.png', '/wallpapers/7.png', '/wallpapers/8.png', '/wallpapers/9.png'];

export function getAppWallpaper(): string {
  return localStorage.getItem(WP_KEY) || APP_WALLPAPERS[0];
}

export function applyAppWallpaper(src: string) {
  try { localStorage.setItem(WP_KEY, src); } catch {}
  document.documentElement.style.setProperty('--app-wallpaper', `url('${src}')`);
}

export function applyAccent(id: AccentId) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  localStorage.setItem('accent', a.id);
  document.documentElement.style.setProperty('--accent', a.color);
  document.documentElement.style.setProperty('--accent-soft', a.soft);
  window.dispatchEvent(new CustomEvent(ACCENT_EVENT, { detail: a.id }));
}

export function getTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'light';
}
export function getAccent(): AccentId {
  return ((localStorage.getItem('accent') as AccentId) || 'purple');
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme);
  const [accent, setAccentState] = useState<AccentId>(getAccent);

  useEffect(() => {
    const h1 = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    const h2 = (e: Event) => setAccentState((e as CustomEvent<AccentId>).detail);
    window.addEventListener(EVENT, h1);
    window.addEventListener(ACCENT_EVENT, h2);
    return () => {
      window.removeEventListener(EVENT, h1);
      window.removeEventListener(ACCENT_EVENT, h2);
    };
  }, []);

  const setTheme = (t: Theme) => { applyTheme(t); setThemeState(t); };
  const setAccent = (a: AccentId) => { applyAccent(a); setAccentState(a); };

  return {
    theme, setTheme, toggle: () => setTheme(theme === 'light' ? 'dark' : 'light'),
    accent, setAccent,
  };
}
