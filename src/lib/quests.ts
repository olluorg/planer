import type { HabitLog, Reflection, Task, TimeEntry } from './types';
import { isoDate, todayISO } from './utils';

export interface QuestContext {
  today: string;
  tasks: Task[];
  habits: { id: string; title: string }[];
  habitLogs: HabitLog[];
  reflections: Reflection[];
  timeEntries: TimeEntry[];
}

export interface QuestDef {
  key: string;
  title: string;
  description: string;
  target: number;
  reward: number; // XP bonus
  measure: (c: QuestContext) => number; // current progress 0..target
}

export const QUEST_POOL: QuestDef[] = [
  {
    key: 'tasks_5',
    title: 'Сделать 5 задач',
    description: 'Закрой 5 задач любого блока',
    target: 5, reward: 25,
    measure: (c) => c.tasks.filter((t) => t.date === c.today && t.status === 'done').length,
  },
  {
    key: 'tasks_3',
    title: 'Сделать 3 задачи',
    description: 'Закрой 3 задачи любого блока',
    target: 3, reward: 15,
    measure: (c) => c.tasks.filter((t) => t.date === c.today && t.status === 'done').length,
  },
  {
    key: 'morning_3',
    title: 'Утренний рывок',
    description: 'Закрой 3 задачи утреннего блока',
    target: 3, reward: 20,
    measure: (c) => c.tasks.filter((t) => t.date === c.today && t.time_block === 'morning' && t.status === 'done').length,
  },
  {
    key: 'evening_2',
    title: 'Вечерний минимум',
    description: 'Закрой 2 задачи вечернего блока',
    target: 2, reward: 15,
    measure: (c) => c.tasks.filter((t) => t.date === c.today && t.time_block === 'evening' && t.status === 'done').length,
  },
  {
    key: 'all_habits',
    title: 'Все привычки',
    description: 'Отметь все привычки сегодня',
    target: -1, reward: 30,
    measure: (c) => c.habits.filter((h) => c.habitLogs.some((l) => l.habit_id === h.id && l.date === c.today)).length,
  },
  {
    key: 'reflection_today',
    title: 'Запиши рефлексию',
    description: 'Отметь настроение и итоги дня',
    target: 1, reward: 20,
    measure: (c) => c.reflections.some((r) => r.date === c.today && r.mood !== null) ? 1 : 0,
  },
  {
    key: 'pomodoro_1',
    title: 'Один помодоро',
    description: 'Заверши 1 pomodoro 25+ мин',
    target: 1, reward: 20,
    measure: (c) => c.timeEntries.filter((e) => isoDate(new Date(e.started_at)) === c.today && e.type === 'pomodoro' && e.duration >= 25 * 60).length,
  },
  {
    key: 'pomodoro_3',
    title: 'Три помодоро',
    description: 'Заверши 3 pomodoro 25+ мин',
    target: 3, reward: 40,
    measure: (c) => c.timeEntries.filter((e) => isoDate(new Date(e.started_at)) === c.today && e.type === 'pomodoro' && e.duration >= 25 * 60).length,
  },
  {
    key: 'priority_2',
    title: 'Главное вперёд',
    description: 'Закрой 2 высокоприоритетные задачи',
    target: 2, reward: 20,
    measure: (c) => c.tasks.filter((t) => t.date === c.today && t.status === 'done' && t.priority === 1).length,
  },
  {
    key: 'subtasks_5',
    title: 'Микрошаги',
    description: 'Закрой 5 подзадач',
    target: 5, reward: 15,
    measure: (c) => c.tasks.filter((t) => t.date === c.today && t.status === 'done' && t.parent_id).length,
  },
];

export interface DailyQuestSet {
  date: string;
  keys: string[];
  rewardedKeys: string[]; // already-awarded
}

export const QUESTS_KEY = 'quests.daily.v1';

export function loadOrGenerate(habits: { id: string }[]): DailyQuestSet {
  const today = todayISO();
  try {
    const raw = localStorage.getItem(QUESTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DailyQuestSet;
      if (parsed.date === today) return parsed;
    }
  } catch {}
  const usable = QUEST_POOL.filter((q) => q.key !== 'all_habits' || habits.length > 0);
  const shuffled = [...usable].sort(() => Math.random() - 0.5);
  const keys = shuffled.slice(0, 3).map((q) => q.key);
  const next: DailyQuestSet = { date: today, keys, rewardedKeys: [] };
  localStorage.setItem(QUESTS_KEY, JSON.stringify(next));
  return next;
}

export function save(state: DailyQuestSet) {
  localStorage.setItem(QUESTS_KEY, JSON.stringify(state));
}

export function effectiveTarget(q: QuestDef, c: QuestContext): number {
  if (q.target > 0) return q.target;
  if (q.key === 'all_habits') return Math.max(1, c.habits.length);
  return 1;
}
