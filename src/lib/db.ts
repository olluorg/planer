import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import { get, set } from 'idb-keyval';

const DB_KEY = 'reform.sqlite.v1';
let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let saveTimer: number | null = null;

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
CREATE INDEX IF NOT EXISTS idx_tasks_date ON tasks(date);
CREATE INDEX IF NOT EXISTS idx_tasks_goal ON tasks(goal_id);
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs(date);
CREATE INDEX IF NOT EXISTS idx_progress_goal ON progress_records(goal_id);
`;

export async function getDB(): Promise<Database> {
  if (db) return db;
  if (!SQL) {
    SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  }
  const stored = await get<Uint8Array>(DB_KEY);
  db = stored ? new SQL.Database(stored) : new SQL.Database();
  db.exec(SCHEMA);
  if (!stored) await persist();
  return db;
}

export async function persist() {
  if (!db) return;
  const data = db.export();
  await set(DB_KEY, data);
}

export function schedulePersist() {
  if (saveTimer) window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void persist();
    saveTimer = null;
  }, 250);
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
