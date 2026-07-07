import { useEffect, useState } from 'react';

/** Стиль игровых иконок: минималистичные SVG (lucide) или эмодзи. */
export type IconStyle = 'svg' | 'emoji';

const KEY = 'ui.icons.v1';
const EVENT = 'thedad-icon-style';

export function getIconStyle(): IconStyle {
  return (localStorage.getItem(KEY) as IconStyle) || 'svg';
}

export function setIconStyle(s: IconStyle) {
  localStorage.setItem(KEY, s);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: s }));
}

export function useIconStyle(): IconStyle {
  const [style, setStyle] = useState<IconStyle>(getIconStyle);
  useEffect(() => {
    const h = (e: Event) => setStyle((e as CustomEvent<IconStyle>).detail);
    window.addEventListener(EVENT, h);
    return () => window.removeEventListener(EVENT, h);
  }, []);
  return style;
}
