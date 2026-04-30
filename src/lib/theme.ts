import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const EVENT = 'reform-theme';
const ACCENT_EVENT = 'reform-accent';

export const ACCENTS = [
  { id: 'green',  label: 'Лайм',       color: '#84CC16', soft: '#A3E635' },
  { id: 'blue',   label: 'Синий',      color: '#3b82f6', soft: '#2563eb' },
  { id: 'purple', label: 'Фиолетовый', color: '#a855f7', soft: '#9333ea' },
  { id: 'pink',   label: 'Розовый',    color: '#ec4899', soft: '#db2777' },
  { id: 'orange', label: 'Оранжевый',  color: '#f97316', soft: '#ea580c' },
  { id: 'cyan',   label: 'Бирюзовый',  color: '#06b6d4', soft: '#0891b2' },
] as const;

export type AccentId = typeof ACCENTS[number]['id'];

export function applyTheme(t: Theme) {
  localStorage.setItem('theme', t);
  document.documentElement.classList.toggle('dark', t === 'dark');
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

export function applyAccent(id: AccentId) {
  const a = ACCENTS.find((x) => x.id === id) ?? ACCENTS[0];
  localStorage.setItem('accent', a.id);
  document.documentElement.style.setProperty('--accent', a.color);
  document.documentElement.style.setProperty('--accent-soft', a.soft);
  window.dispatchEvent(new CustomEvent(ACCENT_EVENT, { detail: a.id }));
}

export function getTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'dark';
}
export function getAccent(): AccentId {
  return ((localStorage.getItem('accent') as AccentId) || 'green');
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
    theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    accent, setAccent,
  };
}
