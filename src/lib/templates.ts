import type { GoalType, TimeBlock } from './types';

export interface TaskTpl {
  title: string;
  time_block?: TimeBlock;
  start_time?: string;
  priority?: number;
  tags?: string;
  estimate_min?: number;
  recurring?: 'daily';
}

export interface HabitTpl {
  title: string;
  color?: string;
  schedule?: 'daily' | 'weekly';
  target_per_week?: number;
}

export interface GoalTpl {
  title: string;
  type: GoalType;
  start_value: number;
  target_value: number;
  unit?: string | null;
  deadline_in_days?: number; // от сегодня
}

export interface TemplatePack {
  id: string;
  emoji: string;
  category: 'routine' | 'fitness' | 'work' | 'study' | 'finance' | 'mindfulness';
  title: string;
  description: string;
  goals?: GoalTpl[];
  habits?: HabitTpl[];
  tasks?: TaskTpl[];
}

export const TEMPLATES: TemplatePack[] = [
  {
    id: 'morning_routine',
    emoji: '🌅',
    category: 'routine',
    title: 'Утренняя рутина',
    description: '5 задач, которые формируют сильное начало дня',
    tasks: [
      { title: 'Подъём в 06:00', time_block: 'morning', start_time: '06:00', priority: 1 },
      { title: 'Стакан воды', time_block: 'morning', start_time: '06:05', priority: 2 },
      { title: 'Зарядка 10 минут', time_block: 'morning', start_time: '06:15', priority: 2, estimate_min: 10 },
      { title: 'Душ', time_block: 'morning', start_time: '06:30', priority: 2 },
      { title: 'Планирование дня', time_block: 'morning', start_time: '07:00', priority: 1, estimate_min: 15 },
    ],
    habits: [
      { title: 'Подъём до 07:00', color: '#facc15' },
    ],
  },
  {
    id: 'evening_wind_down',
    emoji: '🌙',
    category: 'routine',
    title: 'Вечерний ритуал',
    description: 'Дисциплина перед сном для качественного отдыха',
    tasks: [
      { title: 'Без экранов с 21:30', time_block: 'night', start_time: '21:30', priority: 2 },
      { title: 'Чтение 20 страниц', time_block: 'night', start_time: '21:35', priority: 2, estimate_min: 25 },
      { title: 'Рефлексия дня', time_block: 'night', start_time: '22:00', priority: 1, estimate_min: 10 },
      { title: 'Сон до 23:00', time_block: 'night', start_time: '22:30', priority: 1 },
    ],
    habits: [
      { title: 'Без экранов после 21:30', color: '#6366f1' },
      { title: 'Сон 8 часов', color: '#a78bfa' },
    ],
  },
  {
    id: 'healthy_week',
    emoji: '💪',
    category: 'fitness',
    title: 'Здоровая неделя',
    description: 'Базовые привычки физического здоровья',
    habits: [
      { title: 'Пить воду 2 литра', color: '#3b82f6', target_per_week: 7 },
      { title: 'Без сладкого', color: '#22c55e', target_per_week: 6 },
      { title: '10 000 шагов', color: '#22c55e', target_per_week: 7 },
      { title: 'Тренировка', color: '#ef4444', target_per_week: 4 },
    ],
    goals: [
      { title: 'Тренировка 3 раза в неделю', type: 'mid', start_value: 0, target_value: 12, unit: 'трен', deadline_in_days: 30 },
    ],
  },
  {
    id: 'deep_work',
    emoji: '🎯',
    category: 'work',
    title: 'Глубокая работа',
    description: 'Два 90-минутных блока концентрации + защита от отвлечений',
    tasks: [
      { title: 'Глубокая работа · блок 1', time_block: 'morning', start_time: '09:00', priority: 1, estimate_min: 90 },
      { title: 'Перерыв 15 мин', time_block: 'morning', start_time: '10:30', priority: 3 },
      { title: 'Глубокая работа · блок 2', time_block: 'morning', start_time: '10:45', priority: 1, estimate_min: 90 },
      { title: 'Обработать почту', time_block: 'day', start_time: '14:00', priority: 2, estimate_min: 30 },
    ],
    habits: [
      { title: 'Без соц. сетей до обеда', color: '#6366f1' },
      { title: '1 pomodoro 25+ мин', color: '#a78bfa' },
    ],
  },
  {
    id: 'book_in_30',
    emoji: '📚',
    category: 'study',
    title: 'Книга за 30 дней',
    description: 'Цель + ежедневная задача на 30 страниц',
    goals: [
      { title: 'Прочитать книгу', type: 'short', start_value: 0, target_value: 300, unit: 'стр', deadline_in_days: 30 },
    ],
    tasks: [
      { title: 'Прочитать 30 страниц', time_block: 'evening', start_time: '20:00', priority: 1, estimate_min: 40 },
    ],
    habits: [
      { title: 'Чтение 20 страниц', color: '#22c55e' },
    ],
  },
  {
    id: 'finance_basics',
    emoji: '💰',
    category: 'finance',
    title: 'Финансовая база',
    description: 'Подушка безопасности на 3 месяца + ежедневный учёт',
    goals: [
      { title: 'Финансовая подушка', type: 'long', start_value: 0, target_value: 300000, unit: '₽', deadline_in_days: 365 },
    ],
    tasks: [
      { title: 'Записать траты дня', time_block: 'night', start_time: '21:00', priority: 2, estimate_min: 5 },
    ],
    habits: [
      { title: 'Без импульсивных покупок', color: '#22c55e' },
    ],
  },
  {
    id: 'mindfulness',
    emoji: '🧘',
    category: 'mindfulness',
    title: 'Внимательность',
    description: 'Медитация + рефлексия + цифровая гигиена',
    habits: [
      { title: 'Медитация 10 минут', color: '#a78bfa' },
      { title: 'Утренняя рефлексия', color: '#22c55e' },
      { title: 'Без телефона час перед сном', color: '#6366f1' },
    ],
    tasks: [
      { title: 'Медитация', time_block: 'morning', start_time: '07:30', priority: 2, estimate_min: 10 },
    ],
  },
  {
    id: 'language_learning',
    emoji: '🗣️',
    category: 'study',
    title: 'Изучение языка',
    description: 'Цель + ежедневный урок + повторение',
    goals: [
      { title: 'B2 английский', type: 'long', start_value: 0, target_value: 100, unit: '%', deadline_in_days: 180 },
    ],
    tasks: [
      { title: 'Урок Duolingo / Anki', time_block: 'morning', start_time: '07:00', priority: 2, estimate_min: 20 },
      { title: 'Просмотр серии на языке', time_block: 'evening', start_time: '19:00', priority: 3, estimate_min: 30 },
    ],
    habits: [
      { title: 'Урок языка', color: '#3b82f6' },
    ],
  },
];

export const CATEGORY_LABEL: Record<TemplatePack['category'], string> = {
  routine: 'Рутина',
  fitness: 'Здоровье',
  work: 'Работа',
  study: 'Обучение',
  finance: 'Финансы',
  mindfulness: 'Внимательность',
};
