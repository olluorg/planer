import { useEffect, useState } from 'react';

/**
 * Установка PWA на домашний экран. Android/Chrome даёт событие
 * `beforeinstallprompt` — перехватываем и показываем свою кнопку. iOS (Safari)
 * такого события не даёт: там показываем подсказку «Поделиться → На экран Домой».
 */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const EVENT = 'thedad:pwa-installable';
let deferred: BeforeInstallPromptEvent | null = null;

// Слушатели вешаются при импорте модуля (Topbar грузится сразу с App) — не пропускаем событие
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    window.dispatchEvent(new CustomEvent(EVENT));
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    window.dispatchEvent(new CustomEvent(EVENT));
  });
}

export function isStandalone(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as unknown as { standalone?: boolean }).standalone === true;
}

export function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  if (outcome === 'accepted') { deferred = null; window.dispatchEvent(new CustomEvent(EVENT)); }
  return outcome === 'accepted';
}

/** Состояние установки для UI. */
export function usePwaInstall() {
  const [canInstall, setCanInstall] = useState(!!deferred);
  useEffect(() => {
    const sync = () => setCanInstall(!!deferred);
    window.addEventListener(EVENT, sync);
    return () => window.removeEventListener(EVENT, sync);
  }, []);
  const standalone = typeof window !== 'undefined' && isStandalone();
  const ios = typeof navigator !== 'undefined' && isIOS();
  return {
    canInstall,          // Android/Chrome: доступна нативная установка
    iosHint: ios && !standalone, // iOS: показать инструкцию
    standalone,          // уже установлено/запущено как приложение
  };
}
