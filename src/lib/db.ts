import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { get, set, del, keys } from 'idb-keyval';
import { applySyncSchema } from './syncSchema';
import { mergeInto, type MergeStats } from './merge';

export const DB_KEY = 'thedad.sqlite.v1';
const LEGACY_KEYS = ['reform.sqlite.v1'];

/** Версия схемы, которую понимает ЭТА сборка (PRAGMA user_version).
 *  Поднимать на 1 при добавлении миграции в MIGRATIONS. */
export const SCHEMA_VERSION = 2;

const BACKUP_PREFIX = 'thedad.backup.';
export const BACKUPS_EVENT = 'thedad-backups-changed';
const BACKUP_KEEP = 3;
const BACKUP_EVERY_MS = 24 * 60 * 60 * 1000;
const LAST_BACKUP_KEY = 'thedad.backup.last';

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let saveTimer: number | null = null;

/** БД создана более новой версией приложения — открывать её нельзя, иначе
 *  старая сборка молча потеряет незнакомые ей поля. */
export class DbTooNewError extends Error {
  constructor(public dbVersion: number) {
    super(`База данных создана более новой версией приложения (схема ${dbVersion}, поддерживается ${SCHEMA_VERSION}).`);
    this.name = 'DbTooNewError';
  }
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  parent_id TEXT,
  title TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'long',
  metric TEXT,
  start_value REAL DEFAULT 0,
  target_value REAL DEFAULT 100,
  current_value REAL DEFAULT 0,
  unit TEXT,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  color TEXT,
  cover TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  title TEXT NOT NULL,
  notes TEXT,
  date TEXT NOT NULL,
  time_block TEXT,
  priority INTEGER DEFAULT 2,
  status TEXT NOT NULL DEFAULT 'active',
  stage TEXT DEFAULT 'todo',
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS habits (
  id TEXT PRIMARY KEY,
  goal_id TEXT,
  title TEXT NOT NULL,
  schedule TEXT NOT NULL DEFAULT 'daily',
  target_per_week INTEGER DEFAULT 7,
  color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS habit_logs (
  id TEXT PRIMARY KEY,
  habit_id TEXT NOT NULL,
  date TEXT NOT NULL,
  done INTEGER NOT NULL DEFAULT 1,
  UNIQUE(habit_id, date)
);
CREATE TABLE IF NOT EXISTS progress_records (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  date TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT
);
CREATE TABLE IF NOT EXISTS reflections (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  mood INTEGER,
  done TEXT,
  not_done TEXT,
  reason TEXT,
  note TEXT,
  UNIQUE(date)
);
CREATE TABLE IF NOT EXISTS predictions (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  eta TEXT,
  low REAL,
  expected REAL,
  high REAL,
  method TEXT
);
CREATE TABLE IF NOT EXISTS time_entries (
  id TEXT PRIMARY KEY,
  task_id TEXT,
  goal_id TEXT,
  type TEXT NOT NULL DEFAULT 'pomodoro',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
CREATE TABLE IF NOT EXISTS change_log (
  id TEXT PRIMARY KEY,
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ts TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS xp_log (
  id TEXT PRIMARY KEY,
  ts TEXT NOT NULL,
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  source_id TEXT,
  amount INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS achievements (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  unlocked_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS milestones (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL,
  title TEXT NOT NULL,
  value REAL,
  due_date TEXT,
  done_at TEXT,
  sort INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS health_logs (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  note TEXT,
  UNIQUE(date, metric)
);
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_progress_goal ON progress_records(goal_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_task ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS idx_change_log_entity ON change_log(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_xp_log_date ON xp_log(date);
CREATE INDEX IF NOT EXISTS idx_health_logs_date ON health_logs(date);
CREATE INDEX IF NOT EXISTS idx_milestones_goal ON milestones(goal_id);
`;

const POST_MIGRATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
`;

function columnExists(d: Database, table: string, col: string): boolean {
  const stmt = d.prepare(`PRAGMA table_info(${table})`);
  try {
    while (stmt.step()) {
      const r = stmt.getAsObject() as { name: string };
      if (r.name === col) return true;
    }
  } finally { stmt.free(); }
  return false;
}

function userVersion(d: Database): number {
  const stmt = d.prepare(`PRAGMA user_version`);
  try {
    return stmt.step() ? Number((stmt.getAsObject() as { user_version: number }).user_version ?? 0) : 0;
  } finally { stmt.free(); }
}

/** Миграции по номерам: индекс 0 приводит схему к версии 1, индекс 1 — к версии 2 и т.д.
 *  Каждая должна быть идемпотентной — базы «до user_version» приходят с любым набором колонок. */
const MIGRATIONS: Array<(d: Database) => void> = [
  // → 1: колонки, добавлявшиеся до введения версионирования схемы.
  (d) => {
    baselineColumns(d);
  },
  // → 2: слияние при синхронизации — updated_at везде, надгробия, триггеры.
  (d) => {
    applySyncSchema(d);
  },
];

function baselineColumns(d: Database) {
  if (!columnExists(d, 'tasks', 'parent_id')) d.exec(`ALTER TABLE tasks ADD COLUMN parent_id TEXT`);
  if (!columnExists(d, 'tasks', 'tags')) d.exec(`ALTER TABLE tasks ADD COLUMN tags TEXT`);
  if (!columnExists(d, 'tasks', 'estimate_min')) d.exec(`ALTER TABLE tasks ADD COLUMN estimate_min INTEGER`);
  if (!columnExists(d, 'tasks', 'start_time')) d.exec(`ALTER TABLE tasks ADD COLUMN start_time TEXT`);
  if (!columnExists(d, 'goals', 'health_metric')) d.exec(`ALTER TABLE goals ADD COLUMN health_metric TEXT`);
  if (!columnExists(d, 'tasks', 'recurrence')) d.exec(`ALTER TABLE tasks ADD COLUMN recurrence TEXT`);
  if (!columnExists(d, 'tasks', 'stage')) {
    d.exec(`ALTER TABLE tasks ADD COLUMN stage TEXT DEFAULT 'todo'`);
    // выполненные задачи сразу попадают в колонку «Готово»
    d.exec(`UPDATE tasks SET stage = 'done' WHERE status = 'done'`);
  }
  d.exec(POST_MIGRATE_INDEXES);
}

/** Прогоняет недостающие миграции. Бэкап снимается ДО первой из них. */
async function migrate(d: Database, stored: Uint8Array | null) {
  const from = userVersion(d);
  if (from > SCHEMA_VERSION) throw new DbTooNewError(from);
  if (from === SCHEMA_VERSION) return;

  if (stored) await saveBackup(stored, `pre-migrate-${from}`);
  for (let v = from; v < SCHEMA_VERSION; v++) MIGRATIONS[v](d);
  d.exec(`PRAGMA user_version = ${SCHEMA_VERSION}`);
}

/* ---------- кольцевой бэкап ---------- */

/** Кладёт дамп в отдельный ключ и оставляет только BACKUP_KEEP последних. */
export async function saveBackup(data: Uint8Array, reason: string) {
  try {
    await set(`${BACKUP_PREFIX}${Date.now()}.${reason}`, data);
    const all = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(BACKUP_PREFIX));
    const stale = all.sort().slice(0, Math.max(0, all.length - BACKUP_KEEP));
    for (const k of stale) await del(k);
    // Список снимков в настройках обновляется сам, где бы снимок ни сделали.
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(BACKUPS_EVENT));
  } catch {
    // Бэкап — лучшее усилие: нехватка места не должна ломать запуск приложения.
  }
}

export interface BackupEntry { key: string; at: number; reason: string; }

export async function listBackups(): Promise<BackupEntry[]> {
  const all = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(BACKUP_PREFIX));
  return all
    .map((key) => {
      const rest = key.slice(BACKUP_PREFIX.length);
      const dot = rest.indexOf('.');
      return { key, at: Number(rest.slice(0, dot < 0 ? undefined : dot)) || 0, reason: dot < 0 ? '' : rest.slice(dot + 1) };
    })
    .sort((a, b) => b.at - a.at);
}

/** Восстанавливает БД из бэкапа. Текущее состояние предварительно уходит в бэкап же. */
export async function restoreBackup(key: string) {
  const data = await get<Uint8Array>(key);
  if (!data) throw new Error('Бэкап не найден');
  await replaceDatabase(data, 'pre-restore');
}

const SQLITE_MAGIC = 'SQLite format 3\u0000';

/** Заменяет базу целиком: и на диске, и открытую в памяти.
 *
 *  Класть новые байты только в IndexedDB нельзя: открытая база в памяти
 *  остаётся старой, и первая же правка пользователя записывает её поверх
 *  новой. Так терялись данные после входа в синхронизацию на новом
 *  устройстве — а ближайший синк заливал пустую базу на сервер.
 *  Текущее состояние перед заменой уходит в бэкап с меткой reason. */
export async function replaceDatabase(bytes: Uint8Array, reason: string) {
  const head = new TextDecoder().decode(bytes.slice(0, 16));
  if (head !== SQLITE_MAGIC) throw new Error('Это не файл базы данных SQLite');
  if (saveTimer) { window.clearTimeout(saveTimer); saveTimer = null; }
  if (db) {
    await saveBackup(db.export(), reason);
    db.close();
    db = null;
  }
  await set(DB_KEY, bytes);
  await getDB(); // тут же прогоняются миграции, если база старая
}

/** Сливает базу с другого устройства в текущую (см. merge.ts).
 *
 *  Входящая база сперва доводится до текущей схемы: на другом устройстве может
 *  стоять старая версия приложения. Если там версия НОВЕЕ — отказ
 *  (DbTooNewError): сливать поля, о которых эта версия не знает, нельзя.
 *  Снимок перед слиянием не делается: оно транзакционное и ничего не
 *  удаляет без надгробия, а снимок на каждый синк вытеснил бы из кольца
 *  суточные копии. */
export async function mergeIncoming(bytes: Uint8Array): Promise<MergeStats> {
  const head = new TextDecoder().decode(bytes.slice(0, 16));
  if (head !== SQLITE_MAGIC) throw new Error('Это не файл базы данных SQLite');
  const d = await getDB();
  const remote = new SQL!.Database(bytes);
  try {
    remote.exec(SCHEMA);
    await migrate(remote, null);
    const stats = mergeInto(d, remote);
    schedulePersist();
    return stats;
  } finally {
    remote.close();
  }
}

/** Раз в сутки снимает бэкап текущей БД. Вызывается после старта приложения. */
export async function autoBackup() {
  const last = Number(localStorage.getItem(LAST_BACKUP_KEY) || 0);
  if (Date.now() - last < BACKUP_EVERY_MS) return;
  if (!db) return;
  // Отметку ставим ДО записи: экспорт БД асинхронный, и два параллельных вызова
  // (StrictMode, две вкладки) иначе оба проходят проверку и плодят дубли,
  // вытесняя из кольца реальные старые копии.
  try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch {}
  await saveBackup(db.export(), 'daily');
}

/** Просит браузер не выселять IndexedDB. Возвращает итоговый статус. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch { return false; }
}

export async function getDB(): Promise<Database> {
  if (db) return db;
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  }
  let stored = await get<Uint8Array>(DB_KEY);
  if (!stored) {
    for (const k of LEGACY_KEYS) {
      const legacy = await get<Uint8Array>(k);
      if (legacy) { stored = legacy; await set(DB_KEY, legacy); break; }
    }
  }
  const opened = stored ? new SQL.Database(stored) : new SQL.Database();
  try {
    opened.exec(SCHEMA);
    await migrate(opened, stored ?? null);
  } catch (e) {
    // Не оставляем полуоткрытую БД в модуле: следующий getDB() должен пробовать заново.
    opened.close();
    throw e;
  }
  db = opened;
  if (!stored) await persist();
  return db;
}

export async function persist() {
  if (!db) return;
  const data = db.export();
  await set(DB_KEY, data);
}

/** Запись на диск сразу после текущей задачи.
 *
 *  Раньше здесь был debounce на 250 мс, а правки из этого окна должен был
 *  спасать flush на pagehide. Не спасал: запись в IndexedDB, начатая во время
 *  выгрузки страницы, обрывается вместе с документом, и отметка, сделанная
 *  прямо перед закрытием вкладки или обновлением, пропадала (e2e-тест ловит
 *  это стабильно). Теперь окна нет: все exec() одного обработчика склеиваются
 *  в один экспорт, который уходит в IndexedDB, как только обработчик отработал
 *  и интерфейс отрисовался. */
export function schedulePersist() {
  if (saveTimer) return; // экспорт уже запланирован — он заберёт и эту правку
  saveTimer = window.setTimeout(() => {
    saveTimer = null;
    void persist();
  }, 0);
}

/** Сбрасывает запланированную запись немедленно — страховка на уходе со вкладки. */
export function flushPersist() {
  if (!saveTimer) return;
  window.clearTimeout(saveTimer);
  saveTimer = null;
  void persist();
}

let flushBound = false;
/** Вешает flush на уход со вкладки. Основную защиту даёт немедленная запись
 *  в schedulePersist; это лишь подстраховка на случай, если выгрузка началась
 *  в ту же миллисекунду. */
export function bindPersistFlush() {
  if (flushBound) return;
  flushBound = true;
  window.addEventListener('pagehide', flushPersist);
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPersist();
  });
}

export function exec(sql: string, params: any[] = []) {
  const d = db!;
  const stmt = d.prepare(sql);
  try {
    stmt.bind(params);
    while (stmt.step()) {}
  } finally {
    stmt.free();
  }
  schedulePersist();
}

export function query<T = any>(sql: string, params: any[] = []): T[] {
  const d = db!;
  const stmt = d.prepare(sql);
  const rows: T[] = [];
  try {
    stmt.bind(params);
    while (stmt.step()) rows.push(stmt.getAsObject() as T);
  } finally {
    stmt.free();
  }
  return rows;
}

export async function resetDB() {
  await set(DB_KEY, undefined as any);
  db = null;
  await getDB();
}
