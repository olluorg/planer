import type { Layout } from 'react-grid-layout';

export interface Preset {
  id: string;
  label: string;
  description: string;
  layout: Layout[];
  hidden: string[];
}

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
