const BLOCKS = {
  morning: { hour: 7,  name: 'Утро'   },
  day:     { hour: 12, name: 'День'   },
  evening: { hour: 18, name: 'Вечер'  },
  night:   { hour: 21, name: 'Ночь'   },
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function scheduleAlarms() {
  chrome.alarms.clearAll(() => {
    const now = Date.now();
    for (const [block, { hour }] of Object.entries(BLOCKS)) {
      const t = new Date();
      t.setHours(hour, 0, 0, 0);
      if (t.getTime() <= now) t.setDate(t.getDate() + 1);
      chrome.alarms.create(`remind-${block}`, {
        when: t.getTime(),
        periodInMinutes: 1440,
      });
    }
  });
}

chrome.runtime.onInstalled.addListener(scheduleAlarms);
chrome.runtime.onStartup.addListener(scheduleAlarms);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'reschedule') scheduleAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (!alarm.name.startsWith('remind-')) return;
  const block = alarm.name.slice('remind-'.length);
  const info = BLOCKS[block];
  if (!info) return;

  const today = todayISO();
  const data = await chrome.storage.local.get(['planer_tasks', 'planer_notifications_enabled']);
  const tasks = data.planer_tasks || [];
  const enabled = data.planer_notifications_enabled !== false;

  if (!enabled) return;

  const pending = tasks.filter(
    (t) => t.date === today && t.time_block === block && t.status === 'active'
  );
  if (pending.length === 0) return;

  const message =
    pending.length === 1
      ? pending[0].title
      : `${pending[0].title} и ещё ${pending.length - 1}`;

  chrome.notifications.create(`${block}-${today}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: `Planer · ${info.name}`,
    message,
    priority: 1,
  });
});

chrome.notifications.onClicked.addListener((id) => {
  chrome.notifications.clear(id);
  openApp();
});

chrome.action.onClicked.addListener(openApp);

async function openApp() {
  const url = chrome.runtime.getURL('index.html');
  const [existing] = await chrome.tabs.query({ url: `${url}*` });
  if (existing?.id != null) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
}
