/** Каркас для тестов, которым нужна настоящая база: sql.js под Node и
 *  IndexedDB из fake-indexeddb. Каждый тест получает чистое хранилище и свежий
 *  экземпляр модулей (db.ts держит соединение в модульной переменной).
 *
 *  В тестовом файле (vi.mock поднимается выше импортов, поэтому фабрика —
 *  через динамический импорт):
 *    // @vitest-environment happy-dom
 *    vi.mock('sql.js', async (o) => (await import('./dbHarness')).sqlJsWithLocalWasm(o));
 *    vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: '' }));
 */
import 'fake-indexeddb/auto';
import fs from 'node:fs';
import path from 'node:path';
import { vi } from 'vitest';

const WASM = path.resolve(process.cwd(), 'node_modules/sql.js/dist/sql-wasm.wasm');

/** Фабрика для vi.mock('sql.js', …): подкладывает wasm с диска, иначе
 *  emscripten пытается скачать его по URL, которого в тестах нет. */
export async function sqlJsWithLocalWasm(importOriginal: () => Promise<unknown>) {
  const orig = (await importOriginal()) as { default: (cfg?: object) => Promise<unknown> };
  const wasmBinary = fs.readFileSync(WASM);
  return { default: (cfg: object = {}) => orig.default({ ...cfg, wasmBinary }) };
}

/** Чистое хранилище и свежие модули. Возвращает загрузчики модулей. */
export async function freshEnv() {
  localStorage.clear();
  // Сначала даём долететь отложенной записи ПРЕДЫДУЩЕГО теста: schedulePersist
  // ставит её на setTimeout(0), и без этой паузы она срабатывала уже после
  // clear() — старая база записывалась обратно и всплывала в следующем тесте.
  await new Promise((r) => setTimeout(r, 20));
  // Чистим через сам idb-keyval. vi.resetModules пакеты из node_modules не
  // перезагружает: idb-keyval остаётся одним экземпляром и держит соединение
  // с той базой, которую открыл первым, — подменять глобальный indexedDB
  // бесполезно, а deleteDatabase ждал бы закрытия этого соединения вечно.
  const { clear } = await import('idb-keyval');
  await clear();
  vi.resetModules();
  return {
    db: () => import('../db'),
    store: () => import('../store'),
    idb: () => import('idb-keyval'),
  };
}
