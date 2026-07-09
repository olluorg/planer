// Локальные напоминания: таймеры на переднем плане/в фоне вкладки.
// Уведомления показываются через Service Worker registration — это системные
// уведомления (с иконкой приложения), надёжнее, чем new Notification().
// Настоящий web-push при полностью закрытом приложении требует сервера с VAPID.

/** Показать уведомление максимально надёжным доступным способом. */
export async function notify(title: string, opts: NotificationOptions & { tag?: string }): Promise<void> {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const options: NotificationOptions = { icon: '/wallpapers/wp1.jpg', badge: '/favicon.ico', ...opts };
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, options);
      return;
    }
  } catch { /* fallback ниже */ }
  try { new Notification(title, options); } catch {}
}

export type Reminder = {
  id: string;
  text: string;
  time: string; // HH:MM
  enabled: boolean;
};

const STORAGE = 'thedad.notifications.v1';
let timers: number[] = [];

export async function requestPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return Notification.permission;
  return await Notification.requestPermission();
}

export function loadReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(STORAGE);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function saveReminders(r: Reminder[]) {
  localStorage.setItem(STORAGE, JSON.stringify(r));
  scheduleAll();
}

function clearAll() { timers.forEach((t) => window.clearTimeout(t)); timers = []; }

export function scheduleAll() {
  clearAll();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const list = loadReminders();
  const now = new Date();
  list.filter((r) => r.enabled).forEach((r) => {
    const [h, m] = r.time.split(':').map(Number);
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    const delay = target.getTime() - now.getTime();
    const id = window.setTimeout(() => {
      void notify('THEDAD', { body: r.text, tag: r.id });
      scheduleAll();
    }, delay);
    timers.push(id);
  });
}

// Браузер сильно тормозит таймеры в фоновой вкладке — при возврате фокуса
// пере-планируем, чтобы пропущенные за это время напоминания не потерялись.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') scheduleAll();
  });
}

const HEARTBEAT_KEY = 'thedad.heartbeat.enabled.v1';

export function isHeartbeatEnabled(): boolean {
  return localStorage.getItem(HEARTBEAT_KEY) === '1';
}
export function setHeartbeatEnabled(enabled: boolean) {
  localStorage.setItem(HEARTBEAT_KEY, enabled ? '1' : '0');
}

let heartbeatTimers: number[] = [];

function scheduleHeartbeatAt(hh: number, mm: number, body: () => string) {
  const now = new Date();
  const target = new Date();
  target.setHours(hh, mm, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  const delay = target.getTime() - now.getTime();
  const id = window.setTimeout(() => {
    void notify('THEDAD', { body: body(), tag: `heartbeat-${hh}` });
    scheduleHeartbeatAt(hh, mm, body);
  }, delay);
  heartbeatTimers.push(id);
}

interface HeartbeatProviders {
  morningBody: () => string; // top-3 focus
  eveningBody: () => string; // remind reflection / progress
}

export function scheduleHeartbeat(providers: HeartbeatProviders) {
  heartbeatTimers.forEach((t) => window.clearTimeout(t));
  heartbeatTimers = [];
  if (!isHeartbeatEnabled()) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  scheduleHeartbeatAt(8, 0, providers.morningBody);
  scheduleHeartbeatAt(21, 0, providers.eveningBody);
}
