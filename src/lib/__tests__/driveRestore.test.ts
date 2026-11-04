// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { freshEnv } from './dbHarness';

vi.mock('sql.js', async (orig) => (await import('./dbHarness')).sqlJsWithLocalWasm(orig));
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: '' }));

let env: Awaited<ReturnType<typeof freshEnv>>;
beforeEach(async () => {
  env = await freshEnv();
  vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client');
  vi.stubGlobal('chrome', { runtime: { id: 'test' }, identity: {
    getRedirectURL: () => 'https://test.chromiumapp.org/',
    launchWebAuthFlow: async () => 'https://test.chromiumapp.org/#access_token=test&expires_in=3599',
  } });
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

it('replaces the open and persisted database and preserves a snapshot', async () => {
  const db = await env.db();
  const current = await db.getDB();
  db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('current', 'Текущая', 'x', 'x')");
  await db.persist();
  const SQL = await (await import('sql.js')).default();
  const replacement = new SQL.Database(current.export());
  replacement.exec("DELETE FROM goals; INSERT INTO goals (id, title, created_at, updated_at) VALUES ('restored', 'Копия', 'x', 'x')");
  const encrypted = await (await import('../cryptoExport')).encryptBytes(replacement.export(), 'password123');
  replacement.close();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(encrypted as BodyInit, { status: 200 })));
  const drive = await import('../driveBackup');
  await drive.restoreFromDrive('file', 'password123');
  expect(db.query('SELECT id FROM goals')).toEqual([{ id: 'restored' }]);
  await db.persist();
  vi.resetModules();
  const reopened = await import('../db');
  await reopened.getDB();
  expect(reopened.query('SELECT id FROM goals')).toEqual([{ id: 'restored' }]);
  expect((await reopened.listBackups()).some((entry) => entry.reason === 'pre-restore')).toBe(true);
});

it('rejects a decrypted non-database without replacing existing data', async () => {
  const db = await env.db();
  await db.getDB();
  db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('current', 'Текущая', 'x', 'x')");
  await db.persist();
  const encrypted = await (await import('../cryptoExport')).encryptBytes(new TextEncoder().encode('not a database'), 'password123');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(encrypted as BodyInit, { status: 200 })));
  const drive = await import('../driveBackup');
  await expect(drive.restoreFromDrive('file', 'password123')).rejects.toThrow('SQLite');
  expect(db.query('SELECT id FROM goals')).toEqual([{ id: 'current' }]);
});
