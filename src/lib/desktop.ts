/** Мост в main-процесс Electron. В вебе и расширении всё превращается в no-op,
 *  чтобы вызывающему коду не приходилось каждый раз проверять окружение. */

interface DesktopBridge {
  platform: string;
  version: string;
  setReminders?: (r: Array<{ id: string; text: string; time: string; enabled: boolean }>) => void;
}

const bridge = (): DesktopBridge | null =>
  (typeof window !== 'undefined' ? (window as unknown as { desktop?: DesktopBridge }).desktop : undefined) ?? null;

export const isDesktop = (): boolean => Boolean(bridge());

/** Передаёт напоминания в main-процесс: только он показывает их при свёрнутом
 *  в трей окне, когда рендерер уже не работает. */
export function desktopSetReminders(
  reminders: Array<{ id: string; text: string; time: string; enabled: boolean }>,
): void {
  bridge()?.setReminders?.(reminders);
}
