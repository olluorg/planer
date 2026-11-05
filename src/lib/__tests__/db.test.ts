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
  return { ...m, update: (k: IDBValidKey, updater: (old: unknown) => unknown) => {
    const state = globalThis as { __sets?: IDBValidKey[]; __holdSet?: (key: IDBValidKey) => Promise<void> | undefined; __afterUpdate?: (key: IDBValidKey) => Promise<void> | undefined };
    state.__sets?.push(k);
    const hold = state.__holdSet?.(k);
    const result = hold ? hold.then(() => m.update(k, updater)) : m.update(k, updater);
    return result.then(() => state.__afterUpdate?.(k));
  }, set: (k: IDBValidKey, v: unknown) => {
    const state = globalThis as { __sets?: IDBValidKey[]; __failBackupSet?: boolean; __holdSet?: (key: IDBValidKey) => Promise<void> | undefined };
    state.__sets?.push(k);
    if (state.__failBackupSet && typeof k === 'string' && k.startsWith('thedad.backup.')) return Promise.reject(new Error('storage full'));
    const hold = state.__holdSet?.(k);
    if (hold) return hold.then(() => m.set(k, v));
    return m.set(k, v);
  } };
});

let env: Awaited<ReturnType<typeof freshEnv>>;
beforeEach(async () => { (globalThis as { __failBackupSet?: boolean; __holdSet?: unknown; __afterUpdate?: unknown }).__failBackupSet = false; (globalThis as { __holdSet?: unknown }).__holdSet = undefined; (globalThis as { __afterUpdate?: unknown }).__afterUpdate = undefined; env = await freshEnv(); });

/** user_version — 4 байта big-endian по смещению 60 в заголовке файла SQLite. */
const userVersionOf = (b: Uint8Array) => (b[60] << 24) | (b[61] << 16) | (b[62] << 8) | b[63];

describe('база данных', () => {
  it('сохраняет место при обновлении задачи из базы старой схемы', async () => {
    const db = await env.db();
    const active = await db.getDB();
    db.exec("INSERT INTO tasks (id, title, date, status, created_at, updated_at, place_name, place_lat, place_lon) VALUES ('t1', 'Старая', '2026-10-27', 'active', 'x', '2026-10-27T10:00:00.000Z', 'Библиотека', 55.75, 37.62)");
    const SQL = await (await import('sql.js')).default();
    const remote = new SQL.Database(active.export());
    remote.exec("ALTER TABLE tasks DROP COLUMN place_name; ALTER TABLE tasks DROP COLUMN place_lat; ALTER TABLE tasks DROP COLUMN place_lon; PRAGMA user_version = 2; UPDATE tasks SET title = 'Изменена на старом устройстве', updated_at = '2026-10-27T12:00:00.000Z' WHERE id = 't1'");
    await db.mergeIncoming(remote.export()); remote.close();
    expect(db.query("SELECT title, place_name, place_lat, place_lon FROM tasks WHERE id = 't1'")[0]).toEqual({title:'Изменена на старом устройстве', place_name:'Библиотека', place_lat:55.75, place_lon:37.62});
  });
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

  it('копия открытой базы содержит ещё не записанные изменения', async () => {
    const db = await env.db();
    await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('unsaved', 'В памяти', 'x', 'x')");
    const bytes = db.exportOpenDatabase();
    expect(bytes).not.toBeNull();
    const SQL = await (await import('sql.js')).default();
    const copy = new SQL.Database(bytes!);
    try { expect(copy.exec("SELECT id FROM goals WHERE id = 'unsaved'")[0].values).toEqual([['unsaved']]); }
    finally { copy.close(); }
  });

  it('сообщает об ожидающей записи до подтверждения IndexedDB', async () => {
    const db = await env.db();
    await db.getDB();
    let release!: () => void;
    let started!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = (key) => {
      if (key === db.DB_KEY) { started(); return paused; }
    };
    const changes: boolean[] = [];
    const listener = () => changes.push(db.hasPendingPersist());
    window.addEventListener(db.PERSIST_STATUS_EVENT, listener);
    try {
      db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('pending', 'Цель', 'x', 'x')");
      expect(db.hasPendingPersist()).toBe(true);
      const saving = db.persist();
      await entered;
      expect(db.hasPendingPersist()).toBe(true);
      release();
      await saving;
      await vi.waitFor(() => expect(db.hasPendingPersist()).toBe(false));
      expect(changes).toContain(true);
      expect(changes.at(-1)).toBe(false);
    } finally {
      release();
      (globalThis as { __holdSet?: unknown }).__holdSet = undefined;
      window.removeEventListener(db.PERSIST_STATUS_EVENT, listener);
    }
  });

  it('предупреждает при уходе, пока запись не подтверждена', async () => {
    const db = await env.db();
    await db.getDB();
    db.bindPersistFlush();
    let release!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = (key) => key === db.DB_KEY ? paused : undefined;
    try {
      db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('unload', 'Цель', 'x', 'x')");
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(db.hasPendingPersist()).toBe(true);
      release();
      await vi.waitFor(() => expect(db.hasPendingPersist()).toBe(false));
      const savedEvent = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(savedEvent);
      expect(savedEvent.defaultPrevented).toBe(false);
    } finally {
      release();
      (globalThis as { __holdSet?: unknown }).__holdSet = undefined;
    }
  });

  it('не сообщает о завершении, пока более новая запись ожидает сохранения', async () => {
    const db = await env.db();
    await db.getDB();
    let releaseFirst!: () => void;
    let releaseSecond!: () => void;
    let firstStarted!: () => void;
    let secondStarted!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const secondGate = new Promise<void>((resolve) => { releaseSecond = resolve; });
    const firstEntered = new Promise<void>((resolve) => { firstStarted = resolve; });
    const secondEntered = new Promise<void>((resolve) => { secondStarted = resolve; });
    let writes = 0;
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = (key) => {
      if (key !== db.DB_KEY) return;
      writes++;
      if (writes === 1) { firstStarted(); return firstGate; }
      if (writes === 2) { secondStarted(); return secondGate; }
    };
    try {
      db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('first', 'Первое', 'x', 'x')");
      db.flushPersist();
      await firstEntered;
      db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('second', 'Второе', 'x', 'x')");
      db.flushPersist();
      releaseFirst();
      await secondEntered;
      expect(db.hasPendingPersist()).toBe(true);
      releaseSecond();
      await vi.waitFor(() => expect(db.hasPendingPersist()).toBe(false));
      const stored = await (await env.idb()).get<Uint8Array>(db.DB_KEY);
      const SQL = await (await import('sql.js')).default();
      const reopened = new SQL.Database(stored);
      try { expect(reopened.exec('SELECT count(*) FROM goals')[0].values[0][0]).toBe(2); }
      finally { reopened.close(); }
    } finally {
      releaseFirst(); releaseSecond();
      (globalThis as { __holdSet?: unknown }).__holdSet = undefined;
    }
  });

  it('перед перезагрузкой сохраняет и правки, внесённые во время записи', async () => {
    const db = await env.db();
    await db.getDB();
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    let held = false;
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = (key) => {
      if (key === db.DB_KEY && !held) { held = true; started(); return gate; }
    };
    try {
      db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('first', 'Первое', 'x', 'x')");
      const ready = db.persistBeforeReload();
      await entered;
      db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('second', 'Второе', 'x', 'x')");
      release();
      await ready;
      const stored = await (await env.idb()).get<Uint8Array>(db.DB_KEY);
      const SQL = await (await import('sql.js')).default();
      const reopened = new SQL.Database(stored);
      try { expect(reopened.exec('SELECT count(*) FROM goals')[0].values[0][0]).toBe(2); }
      finally { reopened.close(); }
    } finally {
      release();
      (globalThis as { __holdSet?: unknown }).__holdSet = undefined;
    }
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

  it('не заменяет работающую базу файлом будущей версии или повреждённым файлом с правильным заголовком', async () => {
    let db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('keep', 'Сохранить', 'x', 'x')");
    await db.persist();
    const { get } = await env.idb();
    const before = await get(db.DB_KEY);
    const SQL = await (await import('sql.js')).default();
    const future = new SQL.Database(current.export());
    future.exec(`PRAGMA user_version = ${db.SCHEMA_VERSION + 1}`);
    await expect(db.replaceDatabase(future.export(), 'pre-import')).rejects.toBeInstanceOf(db.DbTooNewError);
    future.close();
    const invalid = new Uint8Array(100);
    invalid.set(new TextEncoder().encode('SQLite format 3\0'));
    await expect(db.replaceDatabase(invalid, 'pre-import')).rejects.toThrow();
    expect(await get(db.DB_KEY)).toEqual(before);
    expect(db.query<{ title: string }>("SELECT title FROM goals WHERE id = 'keep'")[0].title).toBe('Сохранить');
    await db.persist();
    vi.resetModules();
    db = await import('../db');
    await db.getDB();
    expect(db.query<{ title: string }>("SELECT title FROM goals WHERE id = 'keep'")[0].title).toBe('Сохранить');
  });

  it('отменяет замену, если снимок текущей базы сохранить не удалось', async () => {
    const db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('keep', 'Сохранить', 'x', 'x')");
    await db.persist();
    const candidate = current.export();
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = true;
    await expect(db.replaceDatabase(candidate, 'pre-import')).rejects.toThrow('операция отменена');
    expect(db.query("SELECT id FROM goals WHERE id = 'keep'")).toHaveLength(1);
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = false;
  });

  it('сброс создаёт снимок и не возвращает устаревшую базу при повторном открытии', async () => {
    const db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('old', 'Сохранить в снимке', 'x', 'x')");
    await db.persist();
    const { set } = await env.idb();
    await set('reform.sqlite.v1', current.export());
    await db.resetDB();
    expect(db.query('SELECT id FROM goals')).toHaveLength(0);
    expect((await db.listBackups()).map(item => item.reason)).toContain('pre-reset');
    vi.resetModules();
    const reopened = await import('../db');
    await reopened.getDB();
    expect(reopened.query('SELECT id FROM goals')).toHaveLength(0);
  });

  it('не сбрасывает базу, если снимок перед сбросом не записан', async () => {
    const db = await env.db();
    await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('keep', 'Останется', 'x', 'x')");
    await db.persist();
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = true;
    await expect(db.resetDB()).rejects.toThrow('операция отменена');
    expect(db.query('SELECT id FROM goals')).toEqual([{ id: 'keep' }]);
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = false;
  });

  it('не объединяет конфликтующие вкладки без резервного снимка', async () => {
    const db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('shared', 'Общая', 'x', 'x')");
    await db.persist();
    const SQL = await (await import('sql.js')).default();
    const other = new SQL.Database(current.export());
    other.exec("UPDATE goals SET title = 'Изменена в другой вкладке' WHERE id = 'shared'");
    other.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('remote', 'Другая вкладка', 'x', 'x')");
    const { set, get } = await env.idb();
    const otherBytes = other.export();
    other.close();
    await set(db.DB_KEY, otherBytes);
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('local', 'Эта вкладка', 'x', 'x')");
    await expect(db.persist()).rejects.toThrow('другой вкладке');
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = true;
    await expect(db.mergeTabConflict()).rejects.toThrow('снимок перед объединением');
    expect(await get(db.DB_KEY)).toEqual(otherBytes);
    expect(db.query("SELECT id FROM goals WHERE id = 'local'")).toHaveLength(1);
    expect(db.hasCrossTabConflict()).toBe(true);
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = false;
  });

  it('сохраняет правку, сделанную после записи объединения, но до его завершения', async () => {
    const db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('shared', 'Общая', 'x', 'x')");
    await db.persist();
    const SQL = await (await import('sql.js')).default();
    const other = new SQL.Database(current.export());
    other.exec("UPDATE goals SET title = 'Изменена в другой вкладке' WHERE id = 'shared'");
    other.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('remote', 'Другая вкладка', 'x', 'x')");
    const { set } = await env.idb();
    await set(db.DB_KEY, other.export());
    other.close();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('local', 'Эта вкладка', 'x', 'x')");
    await expect(db.persist()).rejects.toThrow('другой вкладке');
    let release!: () => void;
    let started!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    let held = false;
    (globalThis as { __afterUpdate?: (key: IDBValidKey) => Promise<void> | undefined }).__afterUpdate = (key) => {
      if (!held && key === db.DB_KEY) { held = true; started(); return paused; }
    };
    const merging = db.mergeTabConflict();
    await entered;
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('during', 'Во время объединения', 'x', 'x')");
    release();
    await merging;
    await db.persist();
    vi.resetModules();
    const reopened = await import('../db');
    await reopened.getDB();
    expect(reopened.query('SELECT id FROM goals ORDER BY id')).toEqual([{ id: 'during' }, { id: 'local' }, { id: 'remote' }, { id: 'shared' }]);
  });

  it.each(['backup', 'database'])('не теряет правку во время замены базы: задержка %s', async (stage) => {
    const db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('old', 'До импорта', 'x', 'x')");
    await db.persist();
    const candidate = current.export();
    let release!: () => void;
    let started!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    let held = false;
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = (key) => {
      if (!held && typeof key === 'string' && (stage === 'backup' ? key.includes('.pre-import') : key === db.DB_KEY)) {
        held = true; started(); return paused;
      }
    };
    const replacing = db.replaceDatabase(candidate, 'pre-import');
    await entered;
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('new', 'Во время импорта', 'x', 'x')");
    const queuedSave = db.persist();
    release();
    await expect(replacing).rejects.toThrow('Данные изменились во время восстановления');
    await queuedSave;
    expect(db.query("SELECT id FROM goals WHERE id = 'new'")).toHaveLength(1);
    vi.resetModules();
    const reopened = await import('../db');
    await reopened.getDB();
    expect(reopened.query("SELECT id FROM goals WHERE id = 'new'")).toHaveLength(1);
  });

  it('откатывает замену, если проверка подключения перестала выполняться во время записи', async () => {
    const db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('old', 'Локальная', 'x', 'x')");
    await db.persist();
    const SQL = await (await import('sql.js')).default();
    const incoming = new SQL.Database(current.export());
    incoming.exec("DELETE FROM goals WHERE id = 'old'");
    let release!: () => void, started!: () => void;
    const paused = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let held = false, valid = true;
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = key => {
      if (!held && key === db.DB_KEY) { held = true; started(); return paused; }
    };
    const replacing = db.replaceDatabase(incoming.export(), 'pre-sync-pull', () => { if (!valid) throw new Error('Подключение изменилось'); });
    await entered;
    valid = false;
    release();
    await expect(replacing).rejects.toThrow('Подключение изменилось');
    vi.resetModules();
    const reopened = await import('../db');
    await reopened.getDB();
    expect(reopened.query("SELECT id FROM goals WHERE id = 'old'")).toHaveLength(1);
    incoming.close();
  });

  it('не сливает удалённую базу, если подключение изменилось к моменту применения', async () => {
    const db = await env.db();
    const current = await db.getDB();
    const SQL = await (await import('sql.js')).default();
    const incoming = new SQL.Database(current.export());
    incoming.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('remote', 'Удалённая', 'x', 'x')");
    await expect(db.mergeIncoming(incoming.export(), () => { throw new Error('Подключение изменилось'); })).rejects.toThrow('Подключение изменилось');
    expect(db.query("SELECT id FROM goals WHERE id = 'remote'")).toHaveLength(0);
    incoming.close();
  });

  it('ожидающее сохранение не перезаписывает восстановленную базу старой', async () => {
    const db = await env.db();
    const current = await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('old', 'Старая', 'x', 'x')");
    await db.persist();
    const SQL = await (await import('sql.js')).default();
    const incoming = new SQL.Database(current.export());
    incoming.exec("DELETE FROM goals WHERE id = 'old'; INSERT INTO goals (id, title, created_at, updated_at) VALUES ('restored', 'Копия', 'x', 'x')");
    let release!: () => void;
    let started!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = (key) => {
      if (typeof key === 'string' && key.includes('.pre-import')) { started(); return paused; }
    };
    const replacing = db.replaceDatabase(incoming.export(), 'pre-import');
    incoming.close();
    await entered;
    const queuedSave = db.persist();
    release();
    await replacing;
    await queuedSave;
    vi.resetModules();
    const reopened = await import('../db');
    await reopened.getDB();
    expect(reopened.query('SELECT id FROM goals')).toEqual([{ id: 'restored' }]);
  });

  it('дожидается ранее начатой записи перед заменой базы', async () => {
    const db = await env.db();
    const current = await db.getDB();
    const SQL = await (await import('sql.js')).default();
    const incoming = new SQL.Database(current.export());
    incoming.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('restored', 'Копия', 'x', 'x')");
    let release!: () => void;
    let started!: () => void;
    const paused = new Promise<void>((resolve) => { release = resolve; });
    const entered = new Promise<void>((resolve) => { started = resolve; });
    let held = false;
    (globalThis as { __holdSet?: (key: IDBValidKey) => Promise<void> | undefined }).__holdSet = (key) => {
      if (!held && key === db.DB_KEY) { held = true; started(); return paused; }
    };
    const priorSave = db.persist();
    await entered;
    const replacing = db.replaceDatabase(incoming.export(), 'pre-import');
    incoming.close();
    release();
    await priorSave;
    await replacing;
    vi.resetModules();
    const reopened = await import('../db');
    await reopened.getDB();
    expect(reopened.query('SELECT id FROM goals')).toEqual([{ id: 'restored' }]);
  });

  it('повторяет автоматическое резервное копирование после ошибки записи', async () => {
    const db = await env.db();
    await db.getDB();
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = true;
    await db.autoBackup();
    expect(localStorage.getItem('thedad.backup.last')).toBeNull();
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = false;
    await db.autoBackup();
    expect((await db.listBackups()).map(b => b.reason)).toContain('daily');
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

  it('не изменяет старую базу, если защитный снимок перед миграцией не записался', async () => {
    const SQL = await (await import('sql.js')).default();
    const legacy = new SQL.Database();
    legacy.exec("CREATE TABLE tasks (id TEXT PRIMARY KEY, goal_id TEXT, title TEXT NOT NULL, notes TEXT, date TEXT NOT NULL, time_block TEXT, priority INTEGER DEFAULT 2, status TEXT NOT NULL DEFAULT 'active', completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); INSERT INTO tasks (id, title, date, status, created_at, updated_at) VALUES ('t1', 'Сохранить', '2026-01-01', 'active', 'x', 'x')");
    const original = legacy.export();
    legacy.close();
    const { set, get } = await env.idb();
    const db = await env.db();
    await set(db.DB_KEY, original);
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = true;
    await expect(db.getDB()).rejects.toThrow('Не удалось сохранить копию базы перед обновлением');
    expect(await get(db.DB_KEY)).toEqual(original);
    (globalThis as { __failBackupSet?: boolean }).__failBackupSet = false;
    await db.getDB();
    expect(db.query<{title:string}>("SELECT title FROM tasks WHERE id='t1'")[0].title).toBe('Сохранить');
  });

  it('мигрирует импорт старой базы до замены действующей', async () => {
    const db = await env.db();
    await db.getDB();
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('old', 'До импорта', 'x', 'x')");
    const SQL = await (await import('sql.js')).default();
    const legacy = new SQL.Database();
    legacy.exec("CREATE TABLE tasks (id TEXT PRIMARY KEY, goal_id TEXT, title TEXT NOT NULL, notes TEXT, date TEXT NOT NULL, time_block TEXT, priority INTEGER DEFAULT 2, status TEXT NOT NULL DEFAULT 'active', completed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL); INSERT INTO tasks (id, title, date, status, created_at, updated_at) VALUES ('t1', 'Импортирована', '2026-01-01', 'done', 'x', 'x')");
    await db.replaceDatabase(legacy.export(), 'pre-import');
    legacy.close();
    expect(db.query<{title:string; stage:string}>("SELECT title, stage FROM tasks WHERE id='t1'")[0]).toEqual({title:'Импортирована',stage:'done'});
    expect((await db.listBackups()).map(b => b.reason)).toContain('pre-import');
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
