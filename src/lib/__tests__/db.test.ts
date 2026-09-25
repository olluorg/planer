// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshEnv } from './dbHarness';

// vi.mock поднимается выше импортов — фабрику берём динамическим импортом.
vi.mock('sql.js', async (orig) => (await import('./dbHarness')).sqlJsWithLocalWasm(orig));
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: '' }));
// Счётчик записей на диск: шпионить за ESM-экспортом нельзя, поэтому
// оборачиваем set на уровне модуля.
vi.mock('idb-keyval', async (orig) => {
  const m = (await orig()) as typeof import('idb-keyval');
  return { ...m, set: (k: IDBValidKey, v: unknown) => { (globalThis as { __sets?: IDBValidKey[] }).__sets?.push(k); return m.set(k, v); } };
});

let env: Awaited<ReturnType<typeof freshEnv>>;
beforeEach(async () => { env = await freshEnv(); });

/** user_version — 4 байта big-endian по смещению 60 в заголовке файла SQLite. */
const userVersionOf = (b: Uint8Array) => (b[60] << 24) | (b[61] << 16) | (b[62] << 8) | b[63];

describe('база данных', () => {
  it('новая база получает схему и текущую версию', async () => {
    const db = await env.db();
    await db.getDB();
    await db.persist();
    const { get } = await env.idb();
    const bytes = (await get(db.DB_KEY)) as Uint8Array;
    expect(userVersionOf(bytes)).toBe(db.SCHEMA_VERSION);
    expect(db.query("SELECT name FROM sqlite_master WHERE name = 'tasks'")).toHaveLength(1);
  });

  it('данные переживают переоткрытие', async () => {
    let db = await env.db();
    await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('g1', 'Цель', 'x', 'x')");
    await db.persist();
    vi.resetModules(); // «перезапуск приложения»: новый модуль, то же хранилище
    db = await import('../db');
    await db.getDB();
    expect(db.query<{ title: string }>('SELECT title FROM goals')[0].title).toBe('Цель');
  });

  it('база из будущей версии не открывается и не портится', async () => {
    const db = await env.db();
    await db.getDB();
    db.exec(`PRAGMA user_version = ${db.SCHEMA_VERSION + 5}`);
    await db.persist();
    const { get } = await env.idb();
    const before = (await get(db.DB_KEY)) as Uint8Array;

    vi.resetModules();
    const again = await import('../db');
    await expect(again.getDB()).rejects.toBeInstanceOf(again.DbTooNewError);
    const after = (await get(db.DB_KEY)) as Uint8Array;
    expect(after).toEqual(before); // ни байта не изменено
  });

  it('старая база без версии мигрирует, а до миграции снимается бэкап', async () => {
    // Имитируем базу «до версионирования»: user_version 0, нет поздних колонок.
    const initSqlJs = (await import('sql.js')).default as unknown as (c?: object) => Promise<{ Database: new () => { exec(s: string): void; export(): Uint8Array } }>;
    const SQL = await initSqlJs();
    const legacy = new SQL.Database();
    legacy.exec(`CREATE TABLE tasks (id TEXT PRIMARY KEY, goal_id TEXT, title TEXT NOT NULL, notes TEXT,
      date TEXT NOT NULL, time_block TEXT, priority INTEGER DEFAULT 2, status TEXT NOT NULL DEFAULT 'active',
      completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      INSERT INTO tasks (id, title, date, status, created_at, updated_at) VALUES ('t1', 'Старая', '2026-01-01', 'done', 'x', 'x');`);
    const { set } = await env.idb();
    const db = await env.db();
    await set(db.DB_KEY, legacy.export());

    await db.getDB();
    const row = db.query<{ stage: string; recurrence: string | null }>("SELECT stage, recurrence FROM tasks WHERE id = 't1'")[0];
    expect(row.stage).toBe('done'); // выполненная задача попала в «Готово»
    expect(row.recurrence).toBeNull();
    const backups = await db.listBackups();
    expect(backups.map((b) => b.reason)).toContain('pre-migrate-0');
  });

  it('кольцо бэкапов держит три последних', async () => {
    const db = await env.db();
    for (let i = 0; i < 5; i++) {
      await db.saveBackup(new Uint8Array([i]), `n${i}`);
      await new Promise((r) => setTimeout(r, 2)); // разные метки времени
    }
    const list = await db.listBackups();
    expect(list.map((b) => b.reason)).toEqual(['n4', 'n3', 'n2']);
  });

  it('восстановление из бэкапа возвращает данные и страхует текущие', async () => {
    const db = await env.db();
    await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('g1', 'Хорошая', 'x', 'x')");
    await db.persist();
    const { get } = await env.idb();
    await db.saveBackup((await get(db.DB_KEY)) as Uint8Array, 'manual');

    db.exec('DELETE FROM goals'); // «авария»
    await db.persist();
    const [manual] = (await db.listBackups()).filter((b) => b.reason === 'manual');
    await db.restoreBackup(manual.key);

    expect(db.query('SELECT * FROM goals')).toHaveLength(1);
    expect((await db.listBackups()).map((b) => b.reason)).toContain('pre-restore');
  });

  it('несколько правок одного обработчика дают одну запись на диск', async () => {
    const db = await env.db();
    await db.getDB();
    const sets: IDBValidKey[] = [];
    (globalThis as { __sets?: IDBValidKey[] }).__sets = sets;
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('a', 'a', 'x', 'x')");
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('b', 'b', 'x', 'x')");
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('c', 'c', 'x', 'x')");
    await new Promise((r) => setTimeout(r, 20));
    expect(sets.filter((k) => k === db.DB_KEY)).toHaveLength(1);
  });

  it('триггеры синхронизации: время правки, надгробие при удалении, снятие при возврате', async () => {
    const db = await env.db();
    await db.getDB();
    db.exec("INSERT INTO progress_records (id, goal_id, date, value, note) VALUES ('p1', 'g', '2026-09-22', 1, NULL)");
    const t1 = db.query<{ updated_at: string }>("SELECT updated_at FROM progress_records WHERE id = 'p1'")[0].updated_at;
    expect(t1).toMatch(/^\d{4}-\d{2}-\d{2}T/); // проставлено при вставке

    await new Promise((r) => setTimeout(r, 5));
    db.exec("UPDATE progress_records SET value = 2 WHERE id = 'p1'");
    const t2 = db.query<{ updated_at: string }>("SELECT updated_at FROM progress_records WHERE id = 'p1'")[0].updated_at;
    expect(t2 > t1).toBe(true); // правка без явного updated_at — время обновилось само

    db.exec("DELETE FROM progress_records WHERE id = 'p1'");
    expect(db.query("SELECT * FROM tombstones WHERE entity = 'progress_records' AND id = 'p1'")).toHaveLength(1);

    db.exec("INSERT INTO progress_records (id, goal_id, date, value, note) VALUES ('p1', 'g', '2026-09-22', 2, NULL)");
    expect(db.query("SELECT * FROM tombstones WHERE id = 'p1'")).toHaveLength(0); // отмена удаления
  });
});
