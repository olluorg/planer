import { useEffect, useState } from 'react';

export type Theme = 'dark' | 'light';

const EVENT = 'reform-theme';

export function applyTheme(t: Theme) {
  localStorage.setItem('theme', t);
  document.documentElement.classList.toggle('dark', t === 'dark');
  window.dispatchEvent(new CustomEvent(EVENT, { detail: t }));
}

export function getTheme(): Theme {
  return (localStorage.getItem('theme') as Theme) || 'dark';
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(getTheme);

  useEffect(() => {
    const handler = (e: Event) => setThemeState((e as CustomEvent<Theme>).detail);
    window.addEventListener(EVENT, handler);
    return () => window.removeEventListener(EVENT, handler);
  }, []);

  const setTheme = (t: Theme) => {
    applyTheme(t);
    setThemeState(t);
  };

  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') };
}
