import { create } from 'zustand';
import { nanoid } from 'nanoid';
import { exec, getDB, query } from './db';
import type { Goal, Habit, HabitLog, ProgressRecord, Reflection, Task, TimeEntry, ChangeLog, XpEntry, Achievement } from './types';
import { ACHIEVEMENTS, checkNewAchievements, computeStreak, levelFromXp, xpTotal, XP_REWARDS, type XpSource } from './gamification';
import { useCombo } from './combo';
import { playSuccess, playUnlock } from './sound';
import { todayISO } from './utils';
import { syncTasksToExtension } from './extension';

interface State {
  ready: boolean;
  goals: Goal[];
  tasks: Task[];
  habits: Habit[];
  habitLogs: HabitLog[];
  progress: ProgressRecord[];
  reflections: Reflection[];
  timeEntries: TimeEntry[];
  changeLog: ChangeLog[];
  xpLog: XpEntry[];
  achievements: Achievement[];
  recentXp: { id: string; amount: number; ts: number }[];
  recentUnlocks: { key: string; ts: number }[];
  init: () => Promise<void>;
  reload: () => void;
  // time entries
  startTimeEntry: (taskId: string | null, type?: 'pomodoro' | 'free') => TimeEntry;
  finishTimeEntry: (id: string, duration: number) => void;
  // change log
  logChange: (entity: string, entity_id: string, field: string, oldV: any, newV: any) => void;
  // gamification
  awardXp: (source: XpSource, sourceId?: string | null) => void;
  runAchievementCheck: () => void;
  dismissRecentXp: () => void;
  dismissRecentUnlock: (key: string) => void;
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
  timeEntries: [],
  changeLog: [],
  xpLog: [],
  achievements: [],
  recentXp: [],
  recentUnlocks: [],

  init: async () => {
    await getDB();
    const goalsCount = query<{ c: number }>('SELECT COUNT(*) c FROM goals')[0]?.c ?? 0;
    if (goalsCount === 0) seed();
    get().reload();
    set({ ready: true });
  },

  reload: () => {
    const tasks = query<Task>('SELECT * FROM tasks ORDER BY date DESC, priority ASC');
    set({
      goals: query<Goal>('SELECT * FROM goals ORDER BY created_at DESC'),
      tasks,
      habits: query<Habit>('SELECT * FROM habits ORDER BY created_at ASC'),
      habitLogs: query<HabitLog>('SELECT * FROM habit_logs'),
      progress: query<ProgressRecord>('SELECT * FROM progress_records ORDER BY date ASC'),
      reflections: query<Reflection>('SELECT * FROM reflections ORDER BY date DESC'),
      timeEntries: query<TimeEntry>('SELECT * FROM time_entries ORDER BY started_at DESC'),
      changeLog: query<ChangeLog>('SELECT * FROM change_log ORDER BY ts DESC LIMIT 500'),
      xpLog: query<XpEntry>('SELECT * FROM xp_log ORDER BY ts DESC'),
      achievements: query<Achievement>('SELECT * FROM achievements ORDER BY unlocked_at DESC'),
    });
    syncTasksToExtension(tasks);
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
    (Object.keys(p) as (keyof Goal)[]).forEach((k) => {
      if (k === 'updated_at') return;
      if ((cur as any)[k] !== (next as any)[k]) {
        get().logChange('goal', id, String(k), (cur as any)[k], (next as any)[k]);
      }
    });
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
      parent_id: t.parent_id ?? null,
      title: t.title,
      notes: t.notes ?? null,
      date: t.date ?? todayISO(),
      time_block: t.time_block ?? null,
      priority: t.priority ?? 2,
      status: t.status ?? 'active',
      tags: t.tags ?? null,
      estimate_min: t.estimate_min ?? null,
      start_time: t.start_time ?? null,
      completed_at: null,
      created_at: now(),
      updated_at: now(),
    };
    exec(
      `INSERT INTO tasks (id, goal_id, parent_id, title, notes, date, time_block, priority, status, tags, estimate_min, start_time, completed_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [task.id, task.goal_id, task.parent_id, task.title, task.notes, task.date, task.time_block, task.priority, task.status, task.tags, task.estimate_min, task.start_time, task.completed_at, task.created_at, task.updated_at],
    );
    get().reload();
    return task;
  },

  updateTask: (id, p) => {
    const cur = query<Task>('SELECT * FROM tasks WHERE id = ?', [id])[0];
    if (!cur) return;
    const next = { ...cur, ...p, updated_at: now() };
    exec(
      `UPDATE tasks SET goal_id=?, parent_id=?, title=?, notes=?, date=?, time_block=?, priority=?, status=?, tags=?, estimate_min=?, start_time=?, completed_at=?, updated_at=? WHERE id=?`,
      [next.goal_id, next.parent_id, next.title, next.notes, next.date, next.time_block, next.priority, next.status, next.tags, next.estimate_min, next.start_time, next.completed_at, next.updated_at, id],
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
    if (!isDone) {
      useCombo.getState().recordCompletion();
      get().awardXp(cur.parent_id ? 'subtask' : 'task', id);
    }
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
      get().awardXp('habit', habit_id);
    }
    get().reload();
  },

  addProgress: (r) => {
    const prev = query<Goal>('SELECT * FROM goals WHERE id = ?', [r.goal_id])[0];
    exec('INSERT INTO progress_records VALUES (?,?,?,?,?)', [nanoid(10), r.goal_id, r.date, r.value, r.note]);
    exec('UPDATE goals SET current_value = ?, updated_at = ? WHERE id = ?', [r.value, now(), r.goal_id]);
    if (prev) get().logChange('progress', r.goal_id, 'current_value', prev.current_value, r.value);
    get().reload();
    get().awardXp('progress', r.goal_id);
  },

  startTimeEntry: (task_id, type = 'pomodoro') => {
    const e: TimeEntry = {
      id: nanoid(10),
      task_id,
      goal_id: task_id ? (query<Task>('SELECT goal_id FROM tasks WHERE id=?', [task_id])[0]?.goal_id ?? null) : null,
      type,
      started_at: now(),
      ended_at: null,
      duration: 0,
      note: null,
    };
    exec('INSERT INTO time_entries VALUES (?,?,?,?,?,?,?,?)', [e.id, e.task_id, e.goal_id, e.type, e.started_at, e.ended_at, e.duration, e.note]);
    get().reload();
    return e;
  },

  finishTimeEntry: (id, duration) => {
    const d = Math.max(0, Math.round(duration));
    exec('UPDATE time_entries SET ended_at=?, duration=? WHERE id=?', [now(), d, id]);
    if (d >= 50 * 60) { useCombo.getState().recordCompletion(); get().awardXp('pomodoro_50', id); }
    else if (d >= 25 * 60) { useCombo.getState().recordCompletion(); get().awardXp('pomodoro_25', id); }
    else if (d >= 15 * 60) get().awardXp('pomodoro_15', id);
    get().reload();
  },

  logChange: (entity, entity_id, field, oldV, newV) => {
    exec('INSERT INTO change_log VALUES (?,?,?,?,?,?,?)', [
      nanoid(10), entity, entity_id, field,
      oldV == null ? null : String(oldV),
      newV == null ? null : String(newV),
      now(),
    ]);
  },

  awardXp: (source, sourceId = null) => {
    const base = XP_REWARDS[source];
    if (!base) return;
    useCombo.getState().refresh();
    const mult = useCombo.getState().multiplier;
    const amount = Math.round(base * mult);
    const id = nanoid(10);
    const ts = now();
    const date = todayISO();
    exec('INSERT INTO xp_log VALUES (?,?,?,?,?,?)', [id, ts, date, source, sourceId, amount]);
    set((st) => ({ recentXp: [...st.recentXp, { id, amount, ts: Date.now() }].slice(-5) }));
    playSuccess();
    get().reload();
    get().runAchievementCheck();
  },

  runAchievementCheck: () => {
    const st = get();
    // combo lifetime count (count distinct boost activations from localStorage history)
    let comboCount = 0;
    try {
      const raw = localStorage.getItem('combo.lifetime.count.v1');
      comboCount = raw ? Number(raw) || 0 : 0;
    } catch {}
    // freezes used
    let freezesUsed = 0;
    try {
      const raw = localStorage.getItem('streak.freezes.used.v1');
      freezesUsed = raw ? (JSON.parse(raw) as string[]).length : 0;
    } catch {}
    // weekly wins
    let weeklyWins = 0;
    try {
      const raw = localStorage.getItem('weekly.wins.v1');
      weeklyWins = raw ? Number(raw) || 0 : 0;
    } catch {}
    // daily quest all-day
    let dailyQuestsAllDayCount = 0;
    try {
      const raw = localStorage.getItem('quests.all_day_count.v1');
      dailyQuestsAllDayCount = raw ? Number(raw) || 0 : 0;
    } catch {}
    // league
    let highestLeagueIndex = 0;
    try {
      const raw = localStorage.getItem('leagues.peak.v1');
      highestLeagueIndex = raw ? Number(raw) || 0 : 0;
    } catch {}
    const weekXp = (() => {
      const ws = new Date(); ws.setHours(0, 0, 0, 0);
      const day = ws.getDay() === 0 ? 6 : ws.getDay() - 1; // Monday-start
      ws.setDate(ws.getDate() - day);
      const dates = Array.from({ length: 7 }, (_, i) => { const d = new Date(ws); d.setDate(d.getDate() + i); return d.toISOString().slice(0, 10); });
      return st.xpLog.filter((e) => dates.includes(e.date)).reduce((s, e) => s + e.amount, 0);
    })();
    const ctx = {
      tasks: st.tasks,
      habitLogs: st.habitLogs,
      reflections: st.reflections,
      xp: xpTotal(st.xpLog),
      level: levelFromXp(xpTotal(st.xpLog)).level,
      streak: computeStreak(new Date(), st.tasks, st.habitLogs, st.reflections),
      pomodoroCount: st.timeEntries.filter((e) => e.type === 'pomodoro' && e.ended_at !== null).length,
      comboCount,
      freezesUsed,
      weeklyWins,
      dailyQuestsAllDayCount,
      highestLeagueIndex,
      weekXp,
    };
    const fresh = checkNewAchievements(ctx, st.achievements);
    if (fresh.length === 0) return;
    fresh.forEach((a) => {
      exec('INSERT INTO achievements VALUES (?,?,?)', [nanoid(10), a.key, now()]);
    });
    set((s) => ({
      recentUnlocks: [...s.recentUnlocks, ...fresh.map((a) => ({ key: a.key, ts: Date.now() }))],
    }));
    playUnlock();
    get().reload();
  },

  dismissRecentXp: () => set({ recentXp: [] }),
  dismissRecentUnlock: (key) => set((s) => ({ recentUnlocks: s.recentUnlocks.filter((u) => u.key !== key) })),

  upsertReflection: (r) => {
    const isNew = !query<Reflection>('SELECT id FROM reflections WHERE date = ?', [r.date])[0];
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
    if (isNew) get().awardXp('reflection', null);
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
    exec('INSERT INTO tasks (id, goal_id, parent_id, title, notes, date, time_block, priority, status, tags, estimate_min, completed_at, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [nanoid(10), ids.g1, null, title, null, today, block, prio, status, null, null, status === 'done' ? t : null, t, t]);
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
