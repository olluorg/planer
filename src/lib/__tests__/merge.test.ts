// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Database } from 'sql.js';
import { freshEnv } from './dbHarness';
import { mergeInto } from '../merge';

vi.mock('sql.js', async (orig) => (await import('./dbHarness')).sqlJsWithLocalWasm(orig));
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: '' }));

/** Два «устройства» с одинаковой свежей схемой: обе базы — копии одной,
 *  созданной приложением, как после первой синхронизации. */
let A: Database;
let B: Database;
let SQL: { Database: new (b?: Uint8Array) => Database };

beforeEach(async () => {
  const env = await freshEnv();
  const db = await env.db();
  await db.getDB();
  await db.persist();
  const { get } = await env.idb();
  const bytes = (await get(db.DB_KEY)) as Uint8Array;
  SQL = (await (await import('sql.js')).default()) as unknown as typeof SQL;
  A = new SQL.Database(bytes);
  B = new SQL.Database(bytes);
});

const q = <T = Record<string, unknown>>(d: Database, sql: string) => {
  const r = d.exec(sql)[0];
  return (r ? r.values.map((v) => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : []) as T[];
};
const at = (iso: string) => `'${iso}'`;
const goal = (d: Database, id: string, title: string, updated: string) =>
  d.exec(`INSERT INTO goals (id, title, created_at, updated_at) VALUES ('${id}', '${title}', 'x', ${at(updated)})`);
/** Слить B в A, затем результат A — в B: как при синхронизации через сервер. */
const syncBoth = () => { mergeInto(A, B); const snap = new SQL.Database(A.export()); mergeInto(B, snap); snap.close(); };
const titles = (d: Database) => q<{ title: string }>(d, 'SELECT title FROM goals ORDER BY id').map((g) => g.title);

describe('слияние двух устройств', () => {
  it('правки разных записей сохраняются обе', () => {
    goal(A, 'a', 'С ноутбука', '2026-09-20T10:00:00.000Z');
    goal(B, 'b', 'С телефона', '2026-09-20T11:00:00.000Z');
    syncBoth();
    expect(titles(A)).toEqual(['С ноутбука', 'С телефона']);
    expect(titles(B)).toEqual(titles(A));
  });

  it('одна запись правилась на обоих — побеждает более поздняя правка', () => {
    goal(A, 'g', 'Исходное', '2026-09-20T10:00:00.000Z');
    mergeInto(B, A); // B получил исходное
    A.exec(`UPDATE goals SET title = 'Правка ноутбука', updated_at = '2026-09-21T09:00:00.000Z' WHERE id = 'g'`);
    B.exec(`UPDATE goals SET title = 'Правка телефона', updated_at = '2026-09-21T12:00:00.000Z' WHERE id = 'g'`);
    syncBoth();
    expect(titles(A)).toEqual(['Правка телефона']);
    expect(titles(B)).toEqual(['Правка телефона']);
  });

  it('раньше это терялось: правка офлайн-телефона не затирается синком с ноутбука', () => {
    goal(A, 'g1', 'Цель 1', '2026-09-20T10:00:00.000Z');
    mergeInto(B, A);
    // Телефон офлайн добавил отметку прогресса; ноутбук поправил другую цель.
    B.exec(`INSERT INTO progress_records (id, goal_id, date, value, note, updated_at) VALUES ('p', 'g1', '2026-09-22', 5, NULL, '2026-09-22T08:00:00.000Z')`);
    goal(A, 'g2', 'Цель 2', '2026-09-22T09:00:00.000Z');
    syncBoth();
    expect(q(A, 'SELECT id FROM progress_records')).toHaveLength(1);
    expect(titles(A)).toEqual(['Цель 1', 'Цель 2']);
  });

  it('удаление новее правки — запись удаляется на обоих', () => {
    goal(A, 'g', 'Лишняя', '2026-09-20T10:00:00.000Z');
    mergeInto(B, A);
    A.exec(`DELETE FROM goals WHERE id = 'g'`); // удалено «сейчас», позже правки
    syncBoth();
    expect(titles(A)).toEqual([]);
    expect(titles(B)).toEqual([]);
  });

  it('правка новее удаления — запись возвращается', () => {
    goal(A, 'g', 'Нужная', '2026-09-20T10:00:00.000Z');
    mergeInto(B, A);
    A.exec(`DELETE FROM goals WHERE id = 'g'`);
    A.exec(`UPDATE tombstones SET deleted_at = '2026-09-21T00:00:00.000Z' WHERE id = 'g'`);
    B.exec(`UPDATE goals SET title = 'Нужная, поправлена', updated_at = '2026-09-22T00:00:00.000Z' WHERE id = 'g'`);
    syncBoth();
    expect(titles(A)).toEqual(['Нужная, поправлена']);
    expect(q(A, `SELECT * FROM tombstones WHERE id = 'g'`)).toHaveLength(0); // устаревшее надгробие убрано
  });

  it('отметка привычки за один день с двух устройств не задваивается', () => {
    A.exec(`INSERT INTO habit_logs (id, habit_id, date, done, updated_at) VALUES ('h-a', 'water', '2026-09-22', 1, '2026-09-22T08:00:00.000Z')`);
    B.exec(`INSERT INTO habit_logs (id, habit_id, date, done, updated_at) VALUES ('h-b', 'water', '2026-09-22', 1, '2026-09-22T09:00:00.000Z')`);
    syncBoth();
    expect(q(A, `SELECT id FROM habit_logs WHERE habit_id = 'water'`)).toEqual([{ id: 'h-b' }]);
    expect(q(B, `SELECT id FROM habit_logs WHERE habit_id = 'water'`)).toEqual([{ id: 'h-b' }]);
  });

  it('повторное слияние ничего не меняет', () => {
    goal(A, 'a', 'A', '2026-09-20T10:00:00.000Z');
    goal(B, 'b', 'B', '2026-09-20T11:00:00.000Z');
    syncBoth();
    expect(mergeInto(A, B)).toEqual({ incoming: 0, deleted: 0 });
    expect(mergeInto(B, A)).toEqual({ incoming: 0, deleted: 0 });
  });

  it('после синка через сервер устройства полностью совпадают', () => {
    goal(A, 'a', 'A', '2026-09-20T10:00:00.000Z');
    goal(B, 'b', 'B', '2026-09-21T10:00:00.000Z');
    B.exec(`INSERT INTO reflections (id, date, mood, done, updated_at) VALUES ('r', '2026-09-21', 3, 'ок', '2026-09-21T20:00:00.000Z')`);
    A.exec(`INSERT INTO achievements (id, key, unlocked_at, updated_at) VALUES ('x1', 'first_goal', 't', '2026-09-20T10:00:00.000Z')`);
    B.exec(`INSERT INTO achievements (id, key, unlocked_at, updated_at) VALUES ('x2', 'first_goal', 't', '2026-09-21T10:00:00.000Z')`);
    syncBoth();
    for (const t of ['goals', 'reflections', 'achievements', 'tombstones']) {
      expect(q(A, `SELECT * FROM ${t} ORDER BY 1, 2`)).toEqual(q(B, `SELECT * FROM ${t} ORDER BY 1, 2`));
    }
    expect(q(A, 'SELECT key FROM achievements')).toEqual([{ key: 'first_goal' }]); // одна награда
  });
});

describe('слияние через базу приложения', () => {
  it('база со старого устройства (схема v1, без надгробий) доводится до текущей и сливается', async () => {
    const env = await freshEnv();
    const db = await env.db();
    await db.getDB();
    // Старое устройство: схема до синхронизации со слиянием.
    const old = new SQL.Database();
    old.exec(`CREATE TABLE goals (id TEXT PRIMARY KEY, parent_id TEXT, title TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'long',
      metric TEXT, start_value REAL DEFAULT 0, target_value REAL DEFAULT 100, current_value REAL DEFAULT 0, unit TEXT,
      deadline TEXT, status TEXT NOT NULL DEFAULT 'active', color TEXT, cover TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO goals (id, title, created_at, updated_at) VALUES ('old', 'Со старого', 'x', '2026-09-01T00:00:00.000Z');
      PRAGMA user_version = 1;`);
    const stats = await db.mergeIncoming(old.export());
    expect(stats.incoming).toBe(1);
    expect(db.query<{ title: string }>('SELECT title FROM goals').map((g) => g.title)).toEqual(['Со старого']);
  });

  it('база с более новой версии приложения не сливается', async () => {
    const env = await freshEnv();
    const db = await env.db();
    await db.getDB();
    const future = new SQL.Database();
    future.exec(`PRAGMA user_version = ${db.SCHEMA_VERSION + 1}`);
    await expect(db.mergeIncoming(future.export())).rejects.toBeInstanceOf(db.DbTooNewError);
  });
});
