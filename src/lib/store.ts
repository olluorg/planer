import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { exec, getDB, query } from './db';
import type { Goal, Habit, HabitLog, ProgressRecord, Reflection, Task } from './types';
import { todayISO } from './utils';

interface State {
  ready: boolean;
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  progress: ProgressRecord[];
  reflections: Reflection[];
  init: () => Promise<void>;
  reload: () => void;
  // goals
  addGoal: (g: Partial<Goal> & { title: string }) => Goal;
  updateGoal: (id: string, p: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  // tasks
  addTask: (t: Partial<Task> & { title: string; date?: string }) => Task;
  updateTask: (id: string, p: Partial<Task>) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  // habits
  addHabit: (h: Partial<Habit> & { title: string }) => Habit;
  updateHabit: (id: string, p: Partial<Habit>) => void;
  removeHabit: (id: string) => void;
  toggleHabitLog: (habitId: string, date: string) => void;
  // progress
  addProgress: (r: Omit<ProgressRecord, 'id'>) => void;
  // reflections
  upsertReflection: (r: Partial<Reflection> & { date: string }) => void;
}

const now = () => new Date().toISOString();

export const useStore = create<State>((set, get) => ({
  ready: false,
  goals: [],
  tasks: [],
  habits: [],
  habitLogs: [],
  progress: [],
  reflections: [],

  init: async () => {
    await getDB();
    const goalsCount = query<{ c: number }>('SELECT COUNT(*) c FROM goals')[0]?.c ?? 0;
    if (goalsCount === 0) seed();
    get().reload();
    set({ ready: true });
  },

  reload: () => {
    set({
      goals: query<Goal>('SELECT * FROM goals ORDER BY created_at DESC'),
      tasks: query<Task>('SELECT * FROM tasks ORDER BY date DESC, priority ASC'),
      habits: query<Habit>('SELECT * FROM habits ORDER BY created_at ASC'),
      habitLogs: query<HabitLog>('SELECT * FROM habit_logs'),
      progress: query<ProgressRecord>('SELECT * FROM progress_records ORDER BY date ASC'),
      reflections: query<Reflection>('SELECT * FROM reflections ORDER BY date DESC'),
    });
  },

  addGoal: (g) => {
    const goal: Goal = {
      id: nanoid(10),
      parent_id: g.parent_id ?? null,
      title: g.title,
      type: g.type ?? 'long',
      metric: g.metric ?? null,
      start_value: g.start_value ?? 0,
      target_value: g.target_value ?? 100,
      current_value: g.current_value ?? g.start_value ?? 0,
      unit: g.unit ?? null,
      deadline: g.deadline ?? null,
      status: g.status ?? 'active',
      color: g.color ?? null,
      cover: g.cover ?? null,
      created_at: now(),
      updated_at: now(),
    };
    exec(
      `INSERT INTO goals VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [goal.id, goal.parent_id, goal.title, goal.type, goal.metric, goal.start_value, goal.target_value, goal.current_value, goal.unit, goal.deadline, goal.status, goal.color, goal.cover, goal.created_at, goal.updated_at],
    );
    get().reload();
    return goal;
  },

  updateGoal: (id, p) => {
    const cur = query<Goal>('SELECT * FROM goals WHERE id = ?', [id])[0];
    if (!cur) return;
    const next = { ...cur, ...p, updated_at: now() };
    exec(
      `UPDATE goals SET parent_id=?, title=?, type=?, metric=?, start_value=?, target_value=?, current_value=?, unit=?, deadline=?, status=?, color=?, cover=?, updated_at=? WHERE id=?`,
      [next.parent_id, next.title, next.type, next.metric, next.start_value, next.target_value, next.current_value, next.unit, next.deadline, next.status, next.color, next.cover, next.updated_at, id],
    );
    get().reload();
  },

  removeGoal: (id) => {
    exec('DELETE FROM goals WHERE id = ?', [id]);
    exec('UPDATE tasks SET goal_id = NULL WHERE goal_id = ?', [id]);
    exec('UPDATE habits SET goal_id = NULL WHERE goal_id = ?', [id]);
    exec('DELETE FROM progress_records WHERE goal_id = ?', [id]);
    get().reload();
  },

  addTask: (t) => {
    const task: Task = {
      id: nanoid(10),
      goal_id: t.goal_id ?? null,
      title: t.title,
      notes: t.notes ?? null,
      date: t.date ?? todayISO(),
      time_block: t.time_block ?? null,
      priority: t.priority ?? 2,
      status: t.status ?? 'active',
      completed_at: null,
      created_at: now(),
      updated_at: now(),
    };
    exec(
      `INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      [task.id, task.goal_id, task.title, task.notes, task.date, task.time_block, task.priority, task.status, task.completed_at, task.created_at, task.updated_at],
    );
    get().reload();
    return task;
  },

  updateTask: (id, p) => {
    const cur = query<Task>('SELECT * FROM tasks WHERE id = ?', [id])[0];
    if (!cur) return;
    const next = { ...cur, ...p, updated_at: now() };
    exec(
      `UPDATE tasks SET goal_id=?, title=?, notes=?, date=?, time_block=?, priority=?, status=?, completed_at=?, updated_at=? WHERE id=?`,
      [next.goal_id, next.title, next.notes, next.date, next.time_block, next.priority, next.status, next.completed_at, next.updated_at, id],
    );
    get().reload();
  },

  toggleTask: (id) => {
    const cur = query<Task>('SELECT * FROM tasks WHERE id = ?', [id])[0];
    if (!cur) return;
    const isDone = cur.status === 'done';
    get().updateTask(id, {
      status: isDone ? 'active' : 'done',
      completed_at: isDone ? null : now(),
    });
  },

  removeTask: (id) => {
    exec('DELETE FROM tasks WHERE id = ?', [id]);
    get().reload();
  },

  addHabit: (h) => {
    const habit: Habit = {
      id: nanoid(10),
      goal_id: h.goal_id ?? null,
      title: h.title,
      schedule: h.schedule ?? 'daily',
      target_per_week: h.target_per_week ?? 7,
      color: h.color ?? null,
      created_at: now(),
      updated_at: now(),
    };
    exec(
      `INSERT INTO habits VALUES (?,?,?,?,?,?,?,?)`,
      [habit.id, habit.goal_id, habit.title, habit.schedule, habit.target_per_week, habit.color, habit.created_at, habit.updated_at],
    );
    get().reload();
    return habit;
  },

  updateHabit: (id, p) => {
    const cur = query<Habit>('SELECT * FROM habits WHERE id = ?', [id])[0];
    if (!cur) return;
    const next = { ...cur, ...p, updated_at: now() };
    exec(
      `UPDATE habits SET goal_id=?, title=?, schedule=?, target_per_week=?, color=?, updated_at=? WHERE id=?`,
      [next.goal_id, next.title, next.schedule, next.target_per_week, next.color, next.updated_at, id],
    );
    get().reload();
  },

  removeHabit: (id) => {
    exec('DELETE FROM habits WHERE id = ?', [id]);
    exec('DELETE FROM habit_logs WHERE habit_id = ?', [id]);
    get().reload();
  },

  toggleHabitLog: (habit_id, date) => {
    const ex = query<HabitLog>('SELECT * FROM habit_logs WHERE habit_id = ? AND date = ?', [habit_id, date])[0];
    if (ex) {
      exec('DELETE FROM habit_logs WHERE id = ?', [ex.id]);
    } else {
      exec('INSERT INTO habit_logs VALUES (?,?,?,1)', [nanoid(10), habit_id, date]);
    }
    get().reload();
  },

  addProgress: (r) => {
    exec('INSERT INTO progress_records VALUES (?,?,?,?,?)', [nanoid(10), r.goal_id, r.date, r.value, r.note]);
    exec('UPDATE goals SET current_value = ?, updated_at = ? WHERE id = ?', [r.value, now(), r.goal_id]);
    get().reload();
  },

  upsertReflection: (r) => {
    const ex = query<Reflection>('SELECT * FROM reflections WHERE date = ?', [r.date])[0];
    if (ex) {
      exec(
        'UPDATE reflections SET mood=?, done=?, not_done=?, reason=?, note=? WHERE id=?',
        [r.mood ?? ex.mood, r.done ?? ex.done, r.not_done ?? ex.not_done, r.reason ?? ex.reason, r.note ?? ex.note, ex.id],
      );
    } else {
      exec(
        'INSERT INTO reflections VALUES (?,?,?,?,?,?,?)',
        [nanoid(10), r.date, r.mood ?? null, r.done ?? null, r.not_done ?? null, r.reason ?? null, r.note ?? null],
      );
    }
    get().reload();
  },
}));

function seed() {
  const ids = { g1: nanoid(10), g2: nanoid(10), g3: nanoid(10), g4: nanoid(10), g5: nanoid(10) };
  const t = now();
  exec(`INSERT INTO goals VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ids.g1, 'Сбросить 5 кг', 'mid', 'weight', 80, 75, 76.8, 'кг', '2026-07-01', 'active', '#22c55e', null, t, t]);
  exec(`INSERT INTO goals VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ids.g2, 'Пробежать 10 км', 'mid', 'distance', 0, 10, 6.2, 'км', '2026-09-01', 'active', '#22c55e', null, t, t]);
  exec(`INSERT INTO goals VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ids.g3, 'Финансовая цель', 'long', 'money', 0, 200000, 120000, '₽', '2026-12-31', 'active', '#22c55e', null, t, t]);
  exec(`INSERT INTO goals VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ids.g4, 'Отпуск в горах', 'long', 'event', 0, 1, 0.6, null, '2026-12-15', 'active', '#22c55e', null, t, t]);
  exec(`INSERT INTO goals VALUES (?,NULL,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [ids.g5, 'Улучшить форму', 'long', 'fitness', 0, 100, 30, '%', '2027-03-01', 'active', '#22c55e', null, t, t]);

  // weight progress, simulated decline
  for (let i = 60; i >= 0; i -= 3) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const v = 80 - ((60 - i) / 60) * 3.2;
    exec('INSERT INTO progress_records VALUES (?,?,?,?,?)', [nanoid(10), ids.g1, d.toISOString().slice(0, 10), Math.round(v * 10) / 10, null]);
  }
  // running
  for (let i = 90; i >= 0; i -= 5) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const v = ((90 - i) / 90) * 6.2;
    exec('INSERT INTO progress_records VALUES (?,?,?,?,?)', [nanoid(10), ids.g2, d.toISOString().slice(0, 10), Math.round(v * 10) / 10, null]);
  }
  // money
  for (let i = 120; i >= 0; i -= 10) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const v = ((120 - i) / 120) * 120000;
    exec('INSERT INTO progress_records VALUES (?,?,?,?,?)', [nanoid(10), ids.g3, d.toISOString().slice(0, 10), Math.round(v), null]);
  }

  // tasks today
  const today = todayISO();
  const tasks = [
    ['Подъём в 06:00', 'morning', 1, 'done'],
    ['Стакан воды', 'morning', 1, 'done'],
    ['Утренняя зарядка', 'morning', 2, 'done'],
    ['Завтрак', 'morning', 2, 'done'],
    ['Работа над проектом', 'morning', 1, 'active'],
    ['Читать 20 страниц', 'morning', 3, 'active'],
    ['10 000 шагов', 'day', 1, 'done'],
    ['Обед без сладкого', 'day', 2, 'done'],
    ['Работа над проектом', 'day', 1, 'done'],
    ['Встреча с командой', 'day', 2, 'active'],
    ['Изучение нового', 'day', 3, 'active'],
    ['Тренировка', 'evening', 1, 'done'],
    ['Душ', 'evening', 2, 'done'],
    ['Ужин', 'evening', 2, 'active'],
    ['Прогулка', 'evening', 3, 'active'],
    ['Медитация', 'evening', 3, 'active'],
    ['Без телефона', 'night', 2, 'done'],
    ['Читать', 'night', 3, 'active'],
    ['Подготовка ко сну', 'night', 3, 'active'],
  ] as const;
  tasks.forEach(([title, block, prio, status]) => {
    exec('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [nanoid(10), ids.g1, title, null, today, block, prio, status, status === 'done' ? t : null, t, t]);
  });

  // habits
  const habits = [
    ['Пить воду 2л', '#22c55e'],
    ['Без сладкого', '#22c55e'],
    ['Медитация 10 мин', '#eab308'],
    ['Читать 20 страниц', '#22c55e'],
  ];
  const habitIds: string[] = [];
  habits.forEach(([title, color]) => {
    const id = nanoid(10);
    habitIds.push(id);
    exec('INSERT INTO habits VALUES (?,?,?,?,?,?,?,?)', [id, ids.g1, title, 'daily', 7, color, t, t]);
  });
  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const date = d.toISOString().slice(0, 10);
    habitIds.forEach((hid, hi) => {
      const target = hi === 2 ? 4 : hi === 3 ? 5 : hi === 1 ? 6 : 7;
      if (i < target) exec('INSERT INTO habit_logs VALUES (?,?,?,1)', [nanoid(10), hid, date]);
    });
  }
}
