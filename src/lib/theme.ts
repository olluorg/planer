import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light' | 'glass';

const EVENT = 'reform-theme';
const ACCENT_EVENT = 'reform-accent';

/* Приглушённая минималистичная палитра — без кислотных тонов */
export const ACCENTS = [
  { id: 'purple',   label: 'Лаванда',   color: '#6366f1', soft: '#818cf8' },
  { id: 'steel',    label: 'Стальной',  color: '#4f7cac', soft: '#6b93bd' },
  { id: 'sage',     label: 'Шалфей',    color: '#6f8f72', soft: '#8aa88d' },
  { id: 'ocean',    label: 'Океан',     color: '#4e8f9e', soft: '#6aa7b5' },
  { id: 'plum',     label: 'Слива',     color: '#8b6aa3', soft: '#a487b8' },
  { id: 'rose',     label: 'Пыльная роза', color: '#b07a8c', soft: '#c295a4' },
  { id: 'terracotta', label: 'Терракота', color: '#bd7a5f', soft: '#cf957d' },
  { id: 'graphite', label: 'Графит',    color: '#64748b', soft: '#7e8da3' },
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
export const APP_WALLPAPERS = Array.from({ length: 12 }, (_, i) => `/wallpapers/wp${i + 1}.jpg`);

export function getAppWallpaper(): string {
  const saved = localStorage.getItem(WP_KEY);
  if (!saved) return APP_WALLPAPERS[0];
  // старые пути (/wallpapers/2.png и т.п.) больше не существуют — откатываем на дефолт
  if (saved.startsWith('/wallpapers/') && !APP_WALLPAPERS.includes(saved)) return APP_WALLPAPERS[0];
  return saved;
}

export function applyAppWallpaper(src: string) {
  try { localStorage.setItem(WP_KEY, src); } catch {}
  document.documentElement.style.setProperty('--app-wallpaper', `url('${src}')`);
}

/* Пользовательские обои (dataURL) — сохраняются в список, чтобы не пропадать при переключении */
const CUSTOM_WP_KEY = 'app.wallpaper.custom.v1';
const MAX_CUSTOM_WP = 6;

export function getCustomWallpapers(): string[] {
  try { return JSON.parse(localStorage.getItem(CUSTOM_WP_KEY) || '[]'); } catch { return []; }
}

/** Добавляет свой фон в список (в начало, с ограничением количества). Возвращает новый список. */
export function addCustomWallpaper(dataUrl: string): string[] {
  const list = [dataUrl, ...getCustomWallpapers().filter((x) => x !== dataUrl)].slice(0, MAX_CUSTOM_WP);
  try { localStorage.setItem(CUSTOM_WP_KEY, JSON.stringify(list)); } catch {}
  return list;
}

export function removeCustomWallpaper(dataUrl: string): string[] {
  const list = getCustomWallpapers().filter((x) => x !== dataUrl);
  try { localStorage.setItem(CUSTOM_WP_KEY, JSON.stringify(list)); } catch {}
  return list;
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
