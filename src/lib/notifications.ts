// Local Notifications API: schedules timeouts while the tab is open.
// True web push (delivered when tab is closed) requires a server with VAPID keys.

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
      try {
        new Notification('THEDAD', { body: r.text, tag: r.id });
      } catch {}
      scheduleAll();
    }, delay);
    timers.push(id);
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
    try { new Notification('THEDAD', { body: body(), tag: `heartbeat-${hh}` }); } catch {}
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
