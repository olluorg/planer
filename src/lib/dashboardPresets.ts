import type { Layout } from 'react-grid-layout';

export interface Preset {
  id: string;
  label: string;
  description: string;
  layout: Layout[];
  hidden: string[];
}

// Раскладка по макету: жёсткие min/max держат пропорции карточек.
// Живёт здесь (а не в Dashboard.tsx), чтобы screens.ts мог её использовать без циклического импорта.
export const DEFAULT_LAYOUT: Layout[] = [
  // Ряд 1: фокус дня + сводка
  { i: 'today-focus',    x: 0, y: 0,  w: 7, h: 5, minW: 4, minH: 4, maxH: 7 },
  { i: 'day-brief',      x: 7, y: 0,  w: 5, h: 5, minW: 3, minH: 4, maxH: 7 },
  // AI-помощник — третий по счёту (порядок массива = порядок на мобильном): высокая карточка
  // занимает правую колонку на два ряда, слева от неё план и привычки
  { i: 'ai-coach',       x: 8, y: 5,  w: 4, h: 12, minW: 4, minH: 10 },
  // Ряд 2: план · привычки (правее — AI)
  { i: 'today-plan',     x: 0, y: 5,  w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'habit-dots',     x: 4, y: 5,  w: 4, h: 6, minW: 3, minH: 4 },
  // Ряд 3: графики
  { i: 'time-alloc',     x: 0, y: 11, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  { i: 'week-progress',  x: 4, y: 11, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  // Ряд 4: постоянство · прогресс целей
  { i: 'consistency',    x: 0, y: 16, w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'goals-progress', x: 4, y: 16, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  // Ряд 5+: остальное
  { i: 'upcoming',       x: 8, y: 17, w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'quick-capture',  x: 0, y: 22, w: 4, h: 5, minW: 3, minH: 4, maxH: 7 },
  { i: 'health',         x: 4, y: 22, w: 4, h: 6, minW: 3, minH: 4 },
  { i: 'calendar',       x: 8, y: 23, w: 4, h: 7, minW: 3, minH: 6 },
  { i: 'workout',        x: 0, y: 28, w: 4, h: 6, minW: 3, minH: 6 },
  { i: 'calories',       x: 4, y: 28, w: 4, h: 6, minW: 3, minH: 5 },
  { i: 'activity',       x: 8, y: 30, w: 4, h: 6, minW: 3, minH: 5 },
  // Дополнительные виджеты (скрыты по умолчанию, включаются в редакторе)
  { i: 'goals-week',    x: 0,  y: 16, w: 12, h: 6, minW: 6, minH: 5 },
  { i: 'block-morning', x: 0,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'block-day',     x: 3,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'block-evening', x: 6,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'block-night',   x: 9,  y: 22, w: 3,  h: 7, minW: 2, minH: 5 },
  { i: 'notes',         x: 0,  y: 29, w: 4,  h: 5, minW: 3, minH: 4 },
  { i: 'plan-future',   x: 0,  y: 34, w: 12, h: 5, minW: 6, minH: 5, maxH: 6 },
  { i: 'focus',         x: 0,  y: 39, w: 6,  h: 4, minW: 4, minH: 4 },
  { i: 'quests',        x: 6,  y: 39, w: 3,  h: 4, minW: 3, minH: 4 },
  { i: 'weekly-challenge', x: 9, y: 39, w: 3, h: 4, minW: 3, minH: 4 },
  { i: 'letter',        x: 0,  y: 43, w: 6,  h: 4, minW: 4, minH: 3 },
  { i: 'quick-add',     x: 6,  y: 43, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'reflection',    x: 9,  y: 43, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'kpi-grid',      x: 0,  y: 47, w: 6,  h: 4, minW: 4, minH: 4 },
  { i: 'reminders',     x: 6,  y: 47, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'coach',         x: 9,  y: 47, w: 3,  h: 4, minW: 3, minH: 3 },
  { i: 'leagues',       x: 0,  y: 51, w: 12, h: 4, minW: 6, minH: 4 },
];

// Скрыты по умолчанию — включаются через «Показать скрытые» в редакторе
export const DEFAULT_HIDDEN = [
  'goals-week', 'block-morning', 'block-day', 'block-evening', 'block-night',
  'notes', 'plan-future', 'focus', 'quests', 'weekly-challenge', 'letter',
  'quick-add', 'kpi-grid', 'reminders', 'leagues', 'coach',
];

/** Все известные виджеты сетки — нужно для «пустого» экрана (всё скрыто). */
export const ALL_WIDGET_IDS = DEFAULT_LAYOUT.map((l) => l.i);

const ALL: Layout[] = [
  { i: 'goals-week',    x: 0,  y: 0,  w: 9, h: 5 },
  { i: 'progress-ring', x: 9,  y: 0,  w: 3, h: 5 },
  { i: 'block-morning', x: 0,  y: 5,  w: 2, h: 5 },
  { i: 'block-day',     x: 2,  y: 5,  w: 2, h: 5 },
  { i: 'block-evening', x: 4,  y: 5,  w: 2, h: 5 },
  { i: 'block-night',   x: 6,  y: 5,  w: 2, h: 5 },
  { i: 'notes',         x: 8,  y: 5,  w: 2, h: 5 },
  { i: 'stats',         x: 10, y: 5,  w: 2, h: 5 },
  { i: 'plan-future',   x: 0,  y: 10, w: 9, h: 5 },
  { i: 'habits',        x: 9,  y: 10, w: 3, h: 5 },
  { i: 'focus',         x: 0,  y: 15, w: 3, h: 4 },
  { i: 'quick-add',     x: 3,  y: 15, w: 3, h: 4 },
  { i: 'reflection',    x: 6,  y: 15, w: 3, h: 4 },
  { i: 'reminders',     x: 9,  y: 15, w: 3, h: 4 },
];

export const PRESETS: Preset[] = [
  {
    id: 'full',
    label: 'Полный',
    description: 'Все виджеты, исходный bento.',
    layout: ALL,
    hidden: [],
  },
  {
    id: 'minimal',
    label: 'Минимум',
    description: 'Только цели, прогресс и сегодняшние задачи.',
    layout: [
      { i: 'goals-week',    x: 0, y: 0, w: 9, h: 6 },
      { i: 'progress-ring', x: 9, y: 0, w: 3, h: 6 },
      { i: 'block-morning', x: 0, y: 6, w: 3, h: 6 },
      { i: 'block-day',     x: 3, y: 6, w: 3, h: 6 },
      { i: 'block-evening', x: 6, y: 6, w: 3, h: 6 },
      { i: 'block-night',   x: 9, y: 6, w: 3, h: 6 },
    ],
    hidden: ['notes', 'stats', 'plan-future', 'habits', 'focus', 'quick-add', 'reflection', 'reminders'],
  },
  {
    id: 'fitness',
    label: 'Фитнес',
    description: 'Статистика, привычки, тайм-блоки.',
    layout: [
      { i: 'stats',         x: 0, y: 0, w: 4, h: 6 },
      { i: 'habits',        x: 4, y: 0, w: 4, h: 6 },
      { i: 'progress-ring', x: 8, y: 0, w: 4, h: 6 },
      { i: 'block-morning', x: 0, y: 6, w: 3, h: 5 },
      { i: 'block-day',     x: 3, y: 6, w: 3, h: 5 },
      { i: 'block-evening', x: 6, y: 6, w: 3, h: 5 },
      { i: 'block-night',   x: 9, y: 6, w: 3, h: 5 },
      { i: 'reflection',    x: 0, y: 11, w: 6, h: 4 },
      { i: 'goals-week',    x: 6, y: 11, w: 6, h: 4 },
    ],
    hidden: ['notes', 'plan-future', 'focus', 'quick-add', 'reminders'],
  },
  {
    id: 'focus',
    label: 'Фокус',
    description: 'Фокус дня, задачи и быстрое добавление.',
    layout: [
      { i: 'focus',         x: 0, y: 0, w: 6, h: 4 },
      { i: 'quick-add',     x: 6, y: 0, w: 6, h: 4 },
      { i: 'block-morning', x: 0, y: 4, w: 3, h: 6 },
      { i: 'block-day',     x: 3, y: 4, w: 3, h: 6 },
      { i: 'block-evening', x: 6, y: 4, w: 3, h: 6 },
      { i: 'block-night',   x: 9, y: 4, w: 3, h: 6 },
      { i: 'notes',         x: 0, y: 10, w: 6, h: 4 },
      { i: 'reminders',     x: 6, y: 10, w: 6, h: 4 },
    ],
    hidden: ['goals-week', 'progress-ring', 'stats', 'plan-future', 'habits', 'reflection'],
  },
  {
    id: 'goals',
    label: 'Цели',
    description: 'Целиком про долгосрочные цели и прогноз.',
    layout: [
      { i: 'goals-week',    x: 0, y: 0, w: 8, h: 6 },
      { i: 'progress-ring', x: 8, y: 0, w: 4, h: 6 },
      { i: 'plan-future',   x: 0, y: 6, w: 12, h: 6 },
      { i: 'stats',         x: 0, y: 12, w: 6, h: 4 },
      { i: 'habits',        x: 6, y: 12, w: 6, h: 4 },
    ],
    hidden: ['block-morning', 'block-day', 'block-evening', 'block-night', 'notes', 'focus', 'quick-add', 'reflection', 'reminders'],
  },
];
