import type { ElementType } from 'react';
import {
  Sun, Moon, CalendarDays, CalendarClock, ListTodo, Repeat, BarChart3, PieChart,
  Target, NotebookPen, Bell, Sparkles, Crosshair, Trophy, Flag, Mail, Plus,
  Gauge, HeartPulse, Dumbbell, Smile, PenLine, Rocket, Newspaper, CircleDot,
  Grid3x3, LayoutGrid, Flame, Activity, Volume2, Bot,
} from 'lucide-react';

/** Категории виджетов — фильтр в окне добавления («Все, Спорт, …»). */
export type WidgetCategory = 'plan' | 'goals' | 'habits' | 'health' | 'analytics' | 'game' | 'tools' | 'plugins';

export const WIDGET_CATEGORY_LABEL: Record<WidgetCategory, string> = {
  plan: 'План',
  goals: 'Цели',
  habits: 'Привычки',
  health: 'Спорт и здоровье',
  analytics: 'Аналитика',
  game: 'Игра',
  tools: 'Инструменты',
  plugins: 'Плагины',
};

export interface WidgetMeta {
  id: string;
  label: string;
  description: string;
  category: WidgetCategory;
  icon: ElementType;
  /** Размер по умолчанию при добавлении на сетку (12 колонок). */
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

/** Все встроенные виджеты дашборда. Плагины добавляются к этому списку динамически. */
export const WIDGET_CATALOG: WidgetMeta[] = [
  // — План
  { id: 'today-focus',   label: 'Фокус дня',            description: 'Главные задачи и запуск Focus Mode', category: 'plan', icon: Crosshair, w: 7, h: 5, minW: 4, minH: 4 },
  { id: 'day-brief',     label: 'Сводка дня',           description: 'Кратко: задачи, привычки, настроение', category: 'plan', icon: Newspaper, w: 5, h: 5, minW: 3, minH: 4 },
  { id: 'today-plan',    label: 'План на сегодня',      description: 'Список задач дня с чекбоксами', category: 'plan', icon: ListTodo, w: 4, h: 6, minW: 3, minH: 4 },
  { id: 'upcoming',      label: 'Ближайшие события',    description: 'Что запланировано на ближайшие дни', category: 'plan', icon: CalendarClock, w: 4, h: 6, minW: 3, minH: 4 },
  { id: 'calendar',      label: 'Календарь',            description: 'Компактный календарь месяца', category: 'plan', icon: CalendarDays, w: 4, h: 7, minW: 3, minH: 6 },
  { id: 'focus',         label: 'Топ-3 задачи',         description: 'Три главные задачи дня с подзадачами', category: 'plan', icon: Target, w: 6, h: 4, minW: 4, minH: 4 },
  { id: 'block-morning', label: 'Тайм-блок · Утро',     description: 'Задачи 06:00–12:00', category: 'plan', icon: Sun, w: 3, h: 7, minW: 2, minH: 5 },
  { id: 'block-day',     label: 'Тайм-блок · День',     description: 'Задачи 12:00–16:00', category: 'plan', icon: Sun, w: 3, h: 7, minW: 2, minH: 5 },
  { id: 'block-evening', label: 'Тайм-блок · Вечер',    description: 'Задачи 16:00–20:00', category: 'plan', icon: Sun, w: 3, h: 7, minW: 2, minH: 5 },
  { id: 'block-night',   label: 'Тайм-блок · Ночь',     description: 'Задачи 20:00–23:00', category: 'plan', icon: Moon, w: 3, h: 7, minW: 2, minH: 5 },

  // — Цели
  { id: 'goals-progress', label: 'Прогресс целей',      description: 'Список целей с процентами', category: 'goals', icon: Target, w: 4, h: 5, minW: 3, minH: 4 },
  { id: 'goals-week',     label: 'Цели на неделю',      description: 'Кольцо недели + статистика', category: 'goals', icon: CircleDot, w: 12, h: 6, minW: 6, minH: 5 },
  { id: 'plan-future',    label: 'План на будущее',     description: 'Карточки долгосрочных целей с прогнозом', category: 'goals', icon: Rocket, w: 12, h: 5, minW: 6, minH: 5 },
  { id: 'kpi-grid',       label: 'KPI-плитки',          description: 'Кольца прогресса выбранных целей', category: 'goals', icon: Gauge, w: 6, h: 4, minW: 4, minH: 4 },
  { id: 'progress-ring',  label: 'Общий прогресс',      description: 'Одно большое кольцо по всем целям', category: 'goals', icon: CircleDot, w: 3, h: 5, minW: 3, minH: 4 },

  // — Привычки
  { id: 'habit-dots', label: 'Привычки недели',   description: 'Точки выполнения по дням', category: 'habits', icon: Repeat, w: 4, h: 6, minW: 3, minH: 4 },
  { id: 'habits',     label: 'Привычки (список)', description: 'Список привычек с прогрессом за неделю', category: 'habits', icon: Repeat, w: 3, h: 5, minW: 3, minH: 4 },

  // — Спорт и здоровье
  { id: 'health',     label: 'Здоровье',            description: 'Шаги, сон, вода и другие метрики', category: 'health', icon: HeartPulse, w: 4, h: 6, minW: 3, minH: 4 },
  { id: 'workout',    label: 'Зарядка 7 минут',     description: '7 упражнений × 1 минута, каждый раз новый набор', category: 'health', icon: Dumbbell, w: 4, h: 6, minW: 3, minH: 6 },
  { id: 'calories',   label: 'Калории сегодня',     description: 'Кольцо съеденного, баланс дня, меню по клику', category: 'health', icon: Flame, w: 4, h: 6, minW: 3, minH: 5 },
  { id: 'activity',   label: 'Активность',          description: 'Шаги + зарядка + тренировки = сожжённые ккал', category: 'health', icon: Activity, w: 4, h: 6, minW: 3, minH: 5 },
  { id: 'stats',      label: 'Фитнес-статистика',   description: 'Шаги, калории, тренировки, вода', category: 'health', icon: Dumbbell, w: 4, h: 5, minW: 3, minH: 4 },
  { id: 'reflection', label: 'Рефлексия',           description: 'Быстрая оценка настроения дня', category: 'health', icon: Smile, w: 3, h: 4, minW: 3, minH: 3 },

  // — Аналитика
  { id: 'consistency',   label: 'Постоянство',           description: 'Тепловая карта активности', category: 'analytics', icon: Grid3x3, w: 4, h: 6, minW: 3, minH: 4 },
  { id: 'time-alloc',    label: 'Распределение времени', description: 'Куда уходит время дня', category: 'analytics', icon: PieChart, w: 4, h: 5, minW: 3, minH: 4 },
  { id: 'week-progress', label: 'Прогресс недели',       description: 'Выполнение задач по дням недели', category: 'analytics', icon: BarChart3, w: 4, h: 5, minW: 3, minH: 4 },

  // — Игра
  { id: 'quests',           label: 'Задания дня',       description: 'Ежедневные квесты с XP', category: 'game', icon: Trophy, w: 3, h: 4, minW: 3, minH: 4 },
  { id: 'weekly-challenge', label: 'Челлендж недели',   description: 'Большой вызов недели с наградой', category: 'game', icon: Flag, w: 3, h: 4, minW: 3, minH: 4 },
  { id: 'letter',           label: 'Письмо от маскота', description: 'Персональное послание по твоему прогрессу', category: 'game', icon: Mail, w: 6, h: 4, minW: 4, minH: 3 },
  { id: 'leagues',          label: 'Лига недели',       description: 'XP за неделю и место в лиге', category: 'game', icon: LayoutGrid, w: 12, h: 4, minW: 6, minH: 4 },

  // — Инструменты
  { id: 'quick-capture', label: 'Быстрая заметка',     description: 'Мгновенный ввод мыслей и задач', category: 'tools', icon: PenLine, w: 4, h: 5, minW: 3, minH: 4 },
  { id: 'notes',         label: 'Заметка на день',     description: 'Свободный текст на сегодня', category: 'tools', icon: NotebookPen, w: 4, h: 5, minW: 3, minH: 4 },
  { id: 'quick-add',     label: 'Быстрое добавление',  description: 'Кнопки: задача, привычка, помодоро…', category: 'tools', icon: Plus, w: 3, h: 4, minW: 3, minH: 3 },
  { id: 'reminders',     label: 'Напоминания',         description: 'Простой чек-лист напоминаний', category: 'tools', icon: Bell, w: 3, h: 4, minW: 3, minH: 3 },
  { id: 'coach',         label: 'Коуч дня',            description: 'Цитата-настрой на день', category: 'tools', icon: Sparkles, w: 3, h: 4, minW: 3, minH: 3 },
  { id: 'ai-coach',      label: 'AI-помощник',         description: 'Составляет план из описания, отвечает на вопросы', category: 'tools', icon: Bot, w: 4, h: 12, minW: 4, minH: 10 },
  { id: 'soundscape',    label: 'Атмосфера (звуки)',   description: 'Дождь, океан, костёр… продолжается и вне фокуса', category: 'tools', icon: Volume2, w: 4, h: 6, minW: 3, minH: 5 },
];
