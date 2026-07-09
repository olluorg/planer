// Клиент E2E-синхронизации. Дамп SQLite шифруется НА КЛИЕНТЕ (AES-GCM) и
// заливается на sync-сервер как непрозрачный блоб. Сервер не знает ключ.
// encKey: из пароля (PBKDF2) для email-входа, либо случайный для QR-привязки.
import { get, set } from 'idb-keyval';
import { DB_KEY, persist } from './db';
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
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
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
  await pullNow(); // на новом устройстве — подтягиваем БД
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
    await pullNow();
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
  const c = getSync(); if (!c) throw new Error('Синхронизация не настроена');
  const bytes = await localDbBytes(); if (!bytes) throw new Error('Нет локальной БД');
  const cipher = toB64(await encryptBytes(bytes, c.encKey));
  const updatedAt = Date.now();
  await api(c.serverUrl, `/vault/${c.syncId}`, { method: 'PUT', headers: { Authorization: `Bearer ${c.authToken}` }, body: JSON.stringify({ ciphertext: cipher, updatedAt }) });
  saveSync({ ...c, lastSync: updatedAt });
  return updatedAt;
}

/** Скачать БД с сервера и применить (перезаписывает локальную). */
export async function pullNow(): Promise<boolean> {
  const c = getSync(); if (!c) throw new Error('Синхронизация не настроена');
  const { ciphertext, updatedAt } = await api(c.serverUrl, `/vault/${c.syncId}`, { headers: { Authorization: `Bearer ${c.authToken}` } });
  if (!ciphertext) return false; // на сервере пусто
  const bytes = await decryptBytes(fromB64(ciphertext), c.encKey);
  await set(DB_KEY, bytes);
  saveSync({ ...c, lastSync: updatedAt });
  return true;
}

/** Умный синк: сравнить время, выбрать безопасное направление. */
export async function syncNow(): Promise<'pushed' | 'pulled' | 'empty'> {
  const c = getSync(); if (!c) throw new Error('Синхронизация не настроена');
  const { updatedAt } = await api(c.serverUrl, `/vault/${c.syncId}`, { headers: { Authorization: `Bearer ${c.authToken}` } });
  const remote = Number(updatedAt) || 0;
  if (remote > (c.lastSync || 0)) { const ok = await pullNow(); return ok ? 'pulled' : 'empty'; }
  await pushNow();
  return 'pushed';
}
