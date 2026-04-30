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
        new Notification('THEDAD', { body: r.text, icon: '/icon-192.png', tag: r.id });
      } catch {}
      scheduleAll(); // reschedule for tomorrow
    }, delay);
    timers.push(id);
  });
}
