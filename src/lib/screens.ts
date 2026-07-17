import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { Layout } from 'react-grid-layout';
import { DEFAULT_LAYOUT, DEFAULT_HIDDEN, ALL_WIDGET_IDS, PRESETS } from './dashboardPresets';

/**
 * Мульти-экраны дашборда — как рабочие столы: у каждого своя раскладка и свой набор виджетов.
 * Раньше дашборд был один (dashboard.layout.v8 / dashboard.hidden.v6) — эти ключи переезжают
 * в первый экран «Главный», чтобы у существующих пользователей ничего не пропало.
 */

export interface Screen {
  id: string;
  name: string;
  layout: Layout[];
  hidden: string[];
}

const KEY = 'dashboard.screens.v1';
const ACTIVE_KEY = 'dashboard.activeScreen.v1';
const LEGACY_LAYOUT = 'dashboard.layout.v8';
const LEGACY_HIDDEN = 'dashboard.hidden.v6';

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

/** Первый запуск: собираем экран «Главный» из старых ключей (или из дефолта). */
function migrate(): Screen[] {
  const saved = readJson<Screen[] | null>(KEY, null);
  if (saved && Array.isArray(saved) && saved.length) return saved;
  return [{
    id: nanoid(8),
    name: 'Главный',
    layout: readJson<Layout[]>(LEGACY_LAYOUT, DEFAULT_LAYOUT),
    hidden: readJson<string[]>(LEGACY_HIDDEN, DEFAULT_HIDDEN),
  }];
}

function persist(screens: Screen[], activeId: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify(screens));
    localStorage.setItem(ACTIVE_KEY, activeId);
  } catch {}
}

/** Шаблоны новых экранов: пресеты раскладки + «пустой» (все виджеты скрыты). */
export const SCREEN_TEMPLATES: { id: string; label: string; description: string }[] = [
  { id: 'blank', label: 'Пустой', description: 'Ни одного виджета — добавишь сам через «+»' },
  { id: 'copy', label: 'Копия текущего', description: 'Тот же набор и раскладка, что сейчас' },
  ...PRESETS.map((p) => ({ id: p.id, label: p.label, description: p.description })),
];

function buildFromTemplate(templateId: string, current: Screen | undefined): Pick<Screen, 'layout' | 'hidden'> {
  if (templateId === 'blank') return { layout: DEFAULT_LAYOUT, hidden: [...ALL_WIDGET_IDS] };
  if (templateId === 'copy' && current) {
    return { layout: JSON.parse(JSON.stringify(current.layout)), hidden: [...current.hidden] };
  }
  const p = PRESETS.find((x) => x.id === templateId);
  if (p) {
    // Пресет описывает ТОЛЬКО свой набор. Всё остальное обязано попасть в hidden явно:
    // иначе «добор новых виджетов» в Dashboard допишет их в раскладку, и они окажутся видимыми.
    const visible = new Set(p.layout.map((l) => l.i).filter((i) => !p.hidden.includes(i)));
    const known = new Set([...ALL_WIDGET_IDS, ...p.layout.map((l) => l.i)]);
    return {
      layout: JSON.parse(JSON.stringify(p.layout)),
      hidden: [...known].filter((i) => !visible.has(i)),
    };
  }
  return { layout: DEFAULT_LAYOUT, hidden: [...DEFAULT_HIDDEN] };
}

interface ScreensState {
  screens: Screen[];
  activeId: string;
  active: () => Screen;
  setActive: (id: string) => void;
  update: (id: string, patch: Partial<Omit<Screen, 'id'>>) => void;
  add: (name: string, templateId: string) => void;
  rename: (id: string, name: string) => void;
  remove: (id: string) => void;
}

export const useScreens = create<ScreensState>((set, get) => {
  const screens = migrate();
  const savedActive = (() => { try { return localStorage.getItem(ACTIVE_KEY); } catch { return null; } })();
  const activeId = screens.some((s) => s.id === savedActive) ? savedActive! : screens[0].id;
  persist(screens, activeId);

  const commit = (next: Screen[], nextActive = get().activeId) => {
    persist(next, nextActive);
    set({ screens: next, activeId: nextActive });
  };

  return {
    screens,
    activeId,
    active: () => get().screens.find((s) => s.id === get().activeId) ?? get().screens[0],

    setActive: (id) => { if (get().screens.some((s) => s.id === id)) commit(get().screens, id); },

    update: (id, patch) => commit(get().screens.map((s) => (s.id === id ? { ...s, ...patch } : s))),

    add: (name, templateId) => {
      const built = buildFromTemplate(templateId, get().active());
      const screen: Screen = { id: nanoid(8), name: name.trim() || `Экран ${get().screens.length + 1}`, ...built };
      commit([...get().screens, screen], screen.id);
    },

    rename: (id, name) => get().update(id, { name: name.trim() || 'Без названия' }),

    // Последний экран не удаляем — дашборду нужен хотя бы один
    remove: (id) => {
      const rest = get().screens.filter((s) => s.id !== id);
      if (!rest.length) return;
      commit(rest, get().activeId === id ? rest[0].id : get().activeId);
    },
  };
});
