// Клиент E2E-синхронизации. Дамп SQLite шифруется НА КЛИЕНТЕ (AES-GCM) и
// заливается на sync-сервер как непрозрачный блоб. Сервер не знает ключ.
// encKey: из пароля (PBKDF2) для email-входа, либо случайный для QR-привязки.
import { get } from 'idb-keyval';
import { DB_KEY, persist, replaceDatabase, mergeIncoming } from './db';
import { encryptBytes, decryptBytes } from './cryptoExport';

export interface SyncConfig {
  serverUrl: string;
  syncId: string;
  authToken: string;
  encKey: string;
  lastSync?: number; // ms, updatedAt последнего успешного обмена
  email?: string;
}

const CFG_KEY = 'thedad.sync.v1';
const EVENT = 'thedad-sync-changed';

export function getSync(): SyncConfig | null {
  try { const raw = localStorage.getItem(CFG_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveSync(cfg: SyncConfig | null) {
  if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CFG_KEY);
  window.dispatchEvent(new CustomEvent(EVENT));
}
export function onSyncChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
export function disconnectSync() { saveSync(null); }

/* base64 <-> bytes (чанками — спред большого массива переполняет стек) */
function toB64(b: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < b.length; i += chunk) s += String.fromCharCode(...b.subarray(i, i + chunk));
  return btoa(s);
}
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64Url = (s: string) => btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64Url = (s: string) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));

/** Детерминированный encKey из пароля и соли (PBKDF2) — сервер его не получает. */
async function deriveEncKey(password: string, saltB64: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = fromB64(saltB64);
  const base = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: salt as BufferSource, iterations: 150_000, hash: 'SHA-256' }, base, 256);
  return toB64(new Uint8Array(bits));
}

async function api(serverUrl: string, path: string, opts: RequestInit = {}): Promise<any> {
  // Content-Type ставим только при наличии тела — иначе Fastify отклоняет пустой JSON-body.
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> || {}) };
  if (opts.body != null) headers['Content-Type'] = 'application/json';
  const res = await fetch(serverUrl.replace(/\/$/, '') + path, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.error || `HTTP ${res.status}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return data;
}

/* ===== Вход ===== */

export async function registerEmail(serverUrl: string, email: string, password: string): Promise<void> {
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  const encKey = await deriveEncKey(password, salt);
  const { syncId, authToken } = await api(serverUrl, '/register', { method: 'POST', body: JSON.stringify({ email, password, salt }) });
  saveSync({ serverUrl, syncId, authToken, encKey, email });
  await pushNow(); // первый заезд — заливаем текущую БД
}

export async function loginEmail(serverUrl: string, email: string, password: string): Promise<void> {
  const { syncId, authToken, salt } = await api(serverUrl, '/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  const encKey = await deriveEncKey(password, salt);
  saveSync({ serverUrl, syncId, authToken, encKey, email });
  // Слияние, а не замена: если на этом устройстве уже что-то было, оно
  // не теряется, а уезжает на сервер вместе с остальным.
  await syncNow();
}

/** Аноним/QR-хост: создаёт vault и случайный encKey. */
export async function createVault(serverUrl: string): Promise<void> {
  const { syncId, authToken } = await api(serverUrl, '/vault', { method: 'POST' });
  const encKey = toB64(crypto.getRandomValues(new Uint8Array(32)));
  saveSync({ serverUrl, syncId, authToken, encKey });
  await pushNow();
}

/* ===== QR-привязка ===== */

/** URL для QR: телефон открывает нативной камерой → приложение подхватит #sync=. */
export function buildSyncLink(): string | null {
  const c = getSync();
  if (!c) return null;
  const payload = toB64Url(JSON.stringify({ s: c.serverUrl, i: c.syncId, t: c.authToken, k: c.encKey }));
  return `${location.origin}${location.pathname}#sync=${payload}`;
}

/** Если в URL есть #sync=, импортируем конфиг и тянем БД. Вызывается на старте App. */
export async function importSyncFromHashIfPresent(): Promise<boolean> {
  const m = location.hash.match(/[#&]sync=([^&]+)/);
  if (!m) return false;
  try {
    const obj = JSON.parse(fromB64Url(m[1]));
    if (!obj?.s || !obj?.i || !obj?.t || !obj?.k) return false;
    saveSync({ serverUrl: obj.s, syncId: obj.i, authToken: obj.t, encKey: obj.k });
    history.replaceState(null, '', location.pathname); // чистим хеш с секретами
    await syncNow();
    return true;
  } catch { return false; }
}

/* ===== Обмен блобами ===== */

async function localDbBytes(): Promise<Uint8Array | null> {
  await persist();
  return (await get<Uint8Array>(DB_KEY)) ?? null;
}

/** Залить локальную БД на сервер (зашифровав). */
export async function pushNow(): Promise<number> {
  await syncNow();
  return getSync()?.lastSync ?? 0;
}

/** Скачать БД с сервера и применить (перезаписывает локальную). */
export async function pullNow(): Promise<boolean> {
  const c = getSync(); if (!c) throw new Error('Синхронизация не настроена');
  const { ciphertext, updatedAt } = await api(c.serverUrl, `/vault/${c.syncId}`, { headers: { Authorization: `Bearer ${c.authToken}` } });
  if (!ciphertext) return false; // на сервере пусто
  const bytes = await decryptBytes(fromB64(ciphertext), c.encKey);
  // Не просто set(DB_KEY): открытая в памяти база иначе затёрла бы скачанную
  // первой же правкой. Текущее состояние уходит в локальный снимок.
  await replaceDatabase(bytes, 'pre-sync-pull');
  saveSync({ ...c, lastSync: updatedAt });
  return true;
}

export const SYNC_MERGED_EVENT = 'thedad-sync-merged';

export interface SyncOutcome {
  /** Записей пришло с других устройств. */
  incoming: number;
  /** Записей удалено, потому что их удалили на другом устройстве. */
  deleted: number;
}

let running: Promise<SyncOutcome> | null = null;

/** Синхронизация со слиянием: скачать → расшифровать → слить построчно с
 *  локальной → залить результат. Раньше здесь побеждало последнее сохранение
 *  целиком, и правка, сделанная на другом устройстве офлайн, молча терялась.
 *  Запись проверяет версию сервера; при одновременной записи повторяем слияние. */
export function syncNow(): Promise<SyncOutcome> {
  // Два синка одновременно (кнопка + автосинк) слили бы одно и то же дважды.
  if (running) return running;
  running = (async () => {
    const c = getSync(); if (!c) throw new Error('Синхронизация не настроена');
    let outcome: SyncOutcome = { incoming: 0, deleted: 0 };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { ciphertext, revision } = await api(c.serverUrl, `/vault/${c.syncId}`, { headers: { Authorization: `Bearer ${c.authToken}` } });
      if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Обновите сервер синхронизации: текущая версия не защищает от одновременной записи');
      if (ciphertext) {
        const bytes = await decryptBytes(fromB64(ciphertext), c.encKey);
        const merged = await mergeIncoming(bytes);
        outcome = { incoming: outcome.incoming + merged.incoming, deleted: outcome.deleted + merged.deleted };
        if (merged.incoming || merged.deleted) window.dispatchEvent(new CustomEvent(SYNC_MERGED_EVENT, { detail: merged }));
      }
      const bytes = await localDbBytes(); if (!bytes) throw new Error('Нет локальной БД');
      const cipher = toB64(await encryptBytes(bytes, c.encKey));
      const updatedAt = Date.now();
      try {
        await api(c.serverUrl, `/vault/${c.syncId}`, { method: 'PUT', headers: { Authorization: `Bearer ${c.authToken}` }, body: JSON.stringify({ ciphertext: cipher, updatedAt, expectedRevision: revision }) });
        const current = getSync();
        if (current?.syncId === c.syncId && current.authToken === c.authToken) saveSync({ ...current, lastSync: updatedAt });
        return outcome;
      } catch (error) {
        if ((error as { status?: number }).status !== 409) throw error;
      }
    }
    throw new Error('Данные меняются на другом устройстве. Повторите синхронизацию.');
  })().finally(() => { running = null; });
  return running;
}

/** A manual request must also read server changes made after an ongoing background sync began. */
export async function syncNowFresh(): Promise<SyncOutcome> {
  const previous = running;
  if (previous) await previous.catch(() => {});
  return syncNow();
}

/** Фоновая синхронизация: при запуске, раз в 5 минут, при возврате сети и
 *  при возвращении на вкладку. Ошибки глотаем — нет сети не повод мешать. */
export function startAutoSync(): () => void {
  const tick = () => { if (getSync() && navigator.onLine !== false) void syncNow().catch(() => {}); };
  const onVisible = () => { if (document.visibilityState === 'visible') tick(); };
  tick();
  const id = window.setInterval(tick, 5 * 60 * 1000);
  window.addEventListener('online', tick);
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    window.clearInterval(id);
    window.removeEventListener('online', tick);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
