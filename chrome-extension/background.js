const BLOCKS = {
  morning: { hour: 7,  name: 'Утро'   },
  day:     { hour: 12, name: 'День'   },
  evening: { hour: 18, name: 'Вечер'  },
  night:   { hour: 21, name: 'Ночь'   },
};

// Календарная дата в поясе пользователя. toISOString() дал бы UTC-день, и
// восточнее Гринвича утреннее напоминание искало бы задачи вчерашней даты.
function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Ближайшее наступление времени hh:mm — сегодня, если ещё не прошло, иначе завтра. */
function nextOccurrence(hh, mm) {
  const t = new Date();
  t.setHours(hh, mm, 0, 0);
  if (t.getTime() <= Date.now()) t.setDate(t.getDate() + 1);
  return t.getTime();
}

async function scheduleAlarms() {
  await chrome.alarms.clearAll();
  for (const [block, { hour }] of Object.entries(BLOCKS)) {
    chrome.alarms.create(`remind-${block}`, { when: nextOccurrence(hour, 0), periodInMinutes: 1440 });
  }

  // Личные напоминания пользователя. Страница кладёт их в chrome.storage, а
  // будильники ставит именно фон: таймеры страницы умирают вместе со вкладкой,
  // и напоминание, ради которого всё затевалось, не приходит.
  const { planer_reminders = [] } = await chrome.storage.local.get('planer_reminders');
  for (const r of planer_reminders) {
    if (!r?.enabled || typeof r.time !== 'string') continue;
    const [hh, mm] = r.time.split(':').map(Number);
    if (!Number.isFinite(hh) || !Number.isFinite(mm)) continue;
    chrome.alarms.create(`custom-${r.id}`, { when: nextOccurrence(hh, mm), periodInMinutes: 1440 });
  }
}

chrome.runtime.onInstalled.addListener(scheduleAlarms);
chrome.runtime.onStartup.addListener(scheduleAlarms);

chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === 'reschedule') void scheduleAlarms();
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  const { planer_notifications_enabled } = await chrome.storage.local.get('planer_notifications_enabled');
  if (planer_notifications_enabled === false) return;

  if (alarm.name.startsWith('custom-')) {
    const id = alarm.name.slice('custom-'.length);
    const { planer_reminders = [] } = await chrome.storage.local.get('planer_reminders');
    const r = planer_reminders.find((x) => x.id === id);
    // Напоминание могли выключить или удалить между установкой будильника и его
    // срабатыванием — тогда просто снимаем будильник.
    if (!r?.enabled) { chrome.alarms.clear(alarm.name); return; }
    chrome.notifications.create(`custom-${id}-${todayISO()}`, {
      type: 'basic', iconUrl: 'icons/icon128.png', title: 'THEDAD', message: r.text, priority: 1,
    });
    return;
  }

  if (!alarm.name.startsWith('remind-')) return;
  const block = alarm.name.slice('remind-'.length);
  const info = BLOCKS[block];
  if (!info) return;

  const today = todayISO();
  const { planer_tasks: tasks = [] } = await chrome.storage.local.get('planer_tasks');

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

/* ===== Быстрая запись из адресной строки: «td купить молоко» ===== */
// Задача кладётся в очередь chrome.storage; страница планера забирает её при
// открытии (или сразу, если открыта). Сам фон базу не трогает — она живёт в
// странице, и два писателя в одну базу — верный путь к потере правок.
chrome.omnibox.setDefaultSuggestion({ description: 'Добавить задачу на сегодня: %s' });

chrome.omnibox.onInputEntered.addListener(async (text) => {
  const title = text.trim();
  if (!title) return;
  const { planer_inbox = [] } = await chrome.storage.local.get('planer_inbox');
  planer_inbox.push({ title, at: Date.now() });
  await chrome.storage.local.set({ planer_inbox });
  chrome.notifications.create(`captured-${Date.now()}`, {
    type: 'basic', iconUrl: 'icons/icon128.png', title: 'Добавлено в THEDAD', message: title, priority: 0,
  });
});
