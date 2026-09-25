// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshEnv } from './dbHarness';

vi.mock('sql.js', async (orig) => (await import('./dbHarness')).sqlJsWithLocalWasm(orig));
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: '' }));
// Звук и конфетти в тестах не нужны: AudioContext в happy-dom нет.
vi.mock('../sound', () => ({ playSuccess: () => {}, playUnlock: () => {}, isSoundEnabled: () => false }));

let S: Awaited<ReturnType<Awaited<ReturnType<typeof freshEnv>>['store']>>['useStore'];
let DB: Awaited<ReturnType<Awaited<ReturnType<typeof freshEnv>>['db']>>;

beforeEach(async () => {
  const env = await freshEnv();
  S = (await env.store()).useStore;
  DB = await env.db();
  await S.getState().init();
});

const st = () => S.getState();

describe('стор: цели, задачи, привычки', () => {
  it('задача создаётся, выполняется и попадает в «Готово»', () => {
    const t = st().addTask({ title: 'Купить молоко', date: '2026-09-22' });
    st().toggleTask(t.id);
    const saved = st().tasks.find((x) => x.id === t.id)!;
    expect(saved.status).toBe('done');
    expect(saved.stage).toBe('done');
    expect(saved.completed_at).toBeTruthy();
  });

  it('повторная отметка возвращает задачу в работу', () => {
    const t = st().addTask({ title: 'X', date: '2026-09-22' });
    st().toggleTask(t.id);
    st().toggleTask(t.id);
    expect(st().tasks.find((x) => x.id === t.id)!.status).toBe('active');
  });

  it('выполнение повторяющейся задачи создаёт следующую — на следующий день, а не на тот же', () => {
    // Регрессия бага с UTC: восточнее Гринвича следующая дата совпадала с текущей.
    const t = st().addTask({ title: 'Зарядка', date: '2026-09-22', recurrence: 'daily' });
    st().toggleTask(t.id);
    const next = st().tasks.filter((x) => x.title === 'Зарядка' && x.status === 'active');
    expect(next.map((x) => x.date)).toEqual(['2026-09-23']);
  });

  it('повторная отметка повторяющейся задачи не плодит дубли следующей', () => {
    const t = st().addTask({ title: 'Зарядка', date: '2026-09-22', recurrence: 'daily' });
    st().toggleTask(t.id);
    st().toggleTask(t.id); // сняли
    st().toggleTask(t.id); // и снова отметили
    expect(st().tasks.filter((x) => x.title === 'Зарядка' && x.date === '2026-09-23')).toHaveLength(1);
  });

  it('удаление задачи убирает и подзадачи', () => {
    const parent = st().addTask({ title: 'Проект', date: '2026-09-22' });
    st().addTask({ title: 'Шаг', date: '2026-09-22', parent_id: parent.id });
    st().removeTask(parent.id);
    expect(st().tasks).toHaveLength(0);
  });

  it('отметка прогресса двигает текущее значение цели и пишется в историю', () => {
    const g = st().addGoal({ title: 'Бег', start_value: 0, target_value: 10, unit: 'км' });
    st().addProgress({ goal_id: g.id, date: '2026-09-22', value: 4, note: null });
    expect(st().goals.find((x) => x.id === g.id)!.current_value).toBe(4);
    expect(st().progress.filter((p) => p.goal_id === g.id)).toHaveLength(1);
  });

  it('отметка привычки переключается туда и обратно', () => {
    const h = st().addHabit({ title: 'Вода' });
    st().toggleHabitLog(h.id, '2026-09-22');
    expect(st().habitLogs.some((l) => l.habit_id === h.id && l.date === '2026-09-22')).toBe(true);
    st().toggleHabitLog(h.id, '2026-09-22');
    expect(st().habitLogs.some((l) => l.habit_id === h.id && l.date === '2026-09-22')).toBe(false);
  });

  it('названия с кавычками и SQL не ломают запросы', () => {
    const evil = `Robert'); DROP TABLE tasks;--`;
    st().addTask({ title: evil, date: '2026-09-22' });
    expect(st().tasks[0].title).toBe(evil);
    expect(DB.query("SELECT name FROM sqlite_master WHERE name = 'tasks'")).toHaveLength(1);
  });

  it('всё переживает перезапуск приложения', async () => {
    st().addGoal({ title: 'Цель', start_value: 0, target_value: 5 });
    st().addTask({ title: 'Задача', date: '2026-09-22' });
    await new Promise((r) => setTimeout(r, 20)); // отложенная запись на диск
    vi.resetModules();
    const again = (await import('../store')).useStore;
    await again.getState().init();
    expect(again.getState().goals.map((g) => g.title)).toEqual(['Цель']);
    expect(again.getState().tasks.map((t) => t.title)).toEqual(['Задача']);
  });

  it('пакетный импорт тысячи задач укладывается в секунду', () => {
    // Регрессия: без batch стор перечитывал все таблицы после каждой задачи,
    // и 1000 задач занимали ~16 секунд замороженного интерфейса.
    const t0 = performance.now();
    st().batch(() => {
      for (let i = 0; i < 1000; i++) st().addTask({ title: `t${i}`, date: '2026-09-25' });
    });
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(st().tasks).toHaveLength(1000);
  });

  it('ошибка посреди пакета откатывает его целиком', () => {
    st().addTask({ title: 'была до импорта', date: '2026-09-25' });
    expect(() => st().batch(() => {
      st().addTask({ title: 'первая из импорта', date: '2026-09-25' });
      throw new Error('битая строка');
    })).toThrow('битая строка');
    expect(st().tasks.map((t) => t.title)).toEqual(['была до импорта']);
  });
});
