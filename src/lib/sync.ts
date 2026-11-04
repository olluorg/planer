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
let connectionGeneration = 0;

function sameConnection(a: SyncConfig | null, b: SyncConfig | null): boolean {
  if (!a || !b) return a === b;
  return a.serverUrl === b.serverUrl && a.syncId === b.syncId && a.authToken === b.authToken && a.encKey === b.encKey;
}

// Other tabs can disconnect and reconnect while this tab is awaiting the network.
// Ignore timestamp-only updates, which are emitted after an ordinary sync.
if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key !== CFG_KEY && event.key !== null) return;
  if (event.key === null) { connectionGeneration++; return; }
  try {
    const before = event.oldValue ? JSON.parse(event.oldValue) as SyncConfig : null;
    const after = event.newValue ? JSON.parse(event.newValue) as SyncConfig : null;
    if (!sameConnection(before, after)) connectionGeneration++;
  } catch { connectionGeneration++; }
});

export function getSync(): SyncConfig | null {
  try { const raw = localStorage.getItem(CFG_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
function saveSync(cfg: SyncConfig | null) {
  const changed = !sameConnection(getSync(), cfg);
  if (cfg) localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
  else localStorage.removeItem(CFG_KEY);
  if (changed) connectionGeneration++;
  window.dispatchEvent(new CustomEvent(EVENT));
}
export function onSyncChange(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}
export function disconnectSync() { saveSync(null); }

function assertSyncConnection(expected: SyncConfig, generation: number) {
  const current = getSync();
  if (generation !== connectionGeneration || !sameConnection(current, expected)) {
    throw new Error('Подключение изменилось во время синхронизации. Повторите действие.');
  }
}

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
  await syncNowFresh();
}

/** Аноним/QR-хост: создаёт vault и случайный encKey. */
export async function createVault(serverUrl: string): Promise<void> {
  const { syncId, authToken } = await api(serverUrl, '/vault', { method: 'POST' });
  const encKey = toB64(crypto.getRandomValues(new Uint8Array(32)));
  saveSync({ serverUrl, syncId, authToken, encKey });
  await pushNow();
}

/* ===== QR-привязка ===== */

/** Native app and extension origins cannot be opened by a phone camera. */
export function syncLinkBase(href: string): string {
  const url = new URL(href);
  return url.protocol === 'http:' || url.protocol === 'https:'
    ? `${url.origin}${url.pathname}`
    : 'https://thedad.ru/';
}

/** Explain common cases where a QR link cannot connect from a second device. */
export function syncLinkWarning(serverUrl: string, pageUrl: string): string | null {
  try {
    const server = new URL(serverUrl);
    const host = server.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (host === 'localhost' || host.endsWith('.localhost') || host === '::1' || host === '0.0.0.0' || /^127\./.test(host)) {
      return 'Адрес сервера указывает на это устройство. На телефоне localhost будет означать сам телефон; укажите доступный ему адрес сервера.';
    }
    if (new URL(syncLinkBase(pageUrl)).protocol === 'https:' && server.protocol !== 'https:') {
      return 'Страница открывается по HTTPS, а сервер указан по HTTP. Браузер телефона может заблокировать соединение; используйте HTTPS для сервера.';
    }
    return null;
  } catch {
    return 'Не удалось определить адрес сервера. Проверьте настройки подключения.';
  }
}

/** URL для QR: телефон открывает нативной камерой → приложение подхватит #sync=. */
export function buildSyncLink(): string | null {
  const c = getSync();
  if (!c) return null;
  const payload = toB64Url(JSON.stringify({ s: c.serverUrl, i: c.syncId, t: c.authToken, k: c.encKey }));
  return `${syncLinkBase(location.href)}#sync=${payload}`;
}

/** Если в URL есть #sync=, импортируем конфиг и тянем БД. Вызывается на старте App. */
export async function importSyncFromHashIfPresent(): Promise<boolean> {
  const m = location.hash.match(/[#&]sync=([^&]+)/);
  if (!m) return false;
  // Remove credentials even if the payload is malformed or the server is offline.
  history.replaceState(null, '', location.pathname + location.search);
  let obj: { s: string; i: string; t: string; k: string };
  try {
    obj = JSON.parse(fromB64Url(m[1]));
    if (!obj || ![obj.s, obj.i, obj.t, obj.k].every(value => typeof value === 'string' && value.length > 0)) return false;
    const url = new URL(obj.s);
    if (!['http:', 'https:'].includes(url.protocol) || fromB64(obj.k).length !== 32) return false;
  } catch { return false; }
  const previous = getSync();
  const incoming: SyncConfig = { serverUrl: obj.s, syncId: obj.i, authToken: obj.t, encKey: obj.k };
  saveSync(incoming);
  try {
    await syncNowFresh();
    return true;
  } catch (error) {
    if (sameConnection(getSync(), incoming)) saveSync(previous);
    throw error;
  }
}

/* ===== Обмен блобами ===== */

async function localDbBytes(): Promise<Uint8Array | null> {
  await persist();
  return (await get<Uint8Array>(DB_KEY)) ?? null;
}

/** Залить локальную БД на сервер (зашифровав). */
export async function pushNow(): Promise<number> {
  await syncNowFresh();
  return getSync()?.lastSync ?? 0;
}

/** Скачать БД с сервера и применить (перезаписывает локальную). */
export async function pullNow(): Promise<boolean> {
  const c = getSync(); if (!c) throw new Error('Синхронизация не настроена');
  const generation = connectionGeneration;
  const { ciphertext, updatedAt } = await api(c.serverUrl, `/vault/${c.syncId}`, { headers: { Authorization: `Bearer ${c.authToken}` } });
  assertSyncConnection(c, generation);
  if (!ciphertext) return false; // на сервере пусто
  const bytes = await decryptBytes(fromB64(ciphertext), c.encKey);
  assertSyncConnection(c, generation);
  // Не просто set(DB_KEY): открытая в памяти база иначе затёрла бы скачанную
  // первой же правкой. Текущее состояние уходит в локальный снимок.
  await replaceDatabase(bytes, 'pre-sync-pull', () => assertSyncConnection(c, generation));
  assertSyncConnection(c, generation);
  saveSync({ ...getSync()!, lastSync: updatedAt });
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
    const generation = connectionGeneration;
    const assertConnection = () => assertSyncConnection(c, generation);
    let outcome: SyncOutcome = { incoming: 0, deleted: 0 };
    for (let attempt = 0; attempt < 5; attempt++) {
      const { ciphertext, revision } = await api(c.serverUrl, `/vault/${c.syncId}`, { headers: { Authorization: `Bearer ${c.authToken}` } });
      assertConnection();
      if (!Number.isSafeInteger(revision) || revision < 0) throw new Error('Обновите сервер синхронизации: текущая версия не защищает от одновременной записи');
      if (ciphertext) {
        const bytes = await decryptBytes(fromB64(ciphertext), c.encKey);
        assertConnection();
        const merged = await mergeIncoming(bytes, assertConnection);
        outcome = { incoming: outcome.incoming + merged.incoming, deleted: outcome.deleted + merged.deleted };
        if (merged.incoming || merged.deleted) window.dispatchEvent(new CustomEvent(SYNC_MERGED_EVENT, { detail: merged }));
      }
      const bytes = await localDbBytes(); if (!bytes) throw new Error('Нет локальной БД');
      const cipher = toB64(await encryptBytes(bytes, c.encKey));
      assertConnection();
      const updatedAt = Date.now();
      try {
        await api(c.serverUrl, `/vault/${c.syncId}`, { method: 'PUT', headers: { Authorization: `Bearer ${c.authToken}` }, body: JSON.stringify({ ciphertext: cipher, updatedAt, expectedRevision: revision }) });
        assertConnection();
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
