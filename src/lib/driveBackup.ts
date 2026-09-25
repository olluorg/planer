/** Резервная копия базы в Google Диск пользователя (папка appDataFolder).
 *
 *  Модель доверия: дамп SQLite шифруется НА УСТРОЙСТВЕ парольной фразой
 *  (AES-GCM + PBKDF2, см. cryptoExport) и только потом уходит в Диск. Ни Google,
 *  ни мы не можем его прочитать. Обратная сторона — потеря фразы означает потерю
 *  копии, поэтому интерфейс обязан предупредить об этом до первой загрузки.
 *
 *  Область доступа единственная: drive.appdata — скрытая папка приложения.
 *  Остальные файлы Диска приложению не видны, доступ отзывается одной кнопкой
 *  в настройках Google-аккаунта.
 */
import { get, set } from 'idb-keyval';
import { DB_KEY, persist, saveBackup } from './db';
import { encryptBytes, decryptBytes } from './cryptoExport';
import { isExtension } from './extension';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
const SCOPE = 'https://www.googleapis.com/auth/drive.appdata';
const GIS_SRC = 'https://accounts.google.com/gsi/client';
const FILES_API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3/files';

const STATE_KEY = 'thedad.drive.v1';
const KEEP = 5;
const AUTO_EVERY_MS = 24 * 60 * 60 * 1000;
export const DRIVE_EVENT = 'thedad-drive-changed';

/** Функция настроена в сборке. Без client_id раздел прячем целиком. */
export const driveConfigured = () => Boolean(CLIENT_ID);

interface DriveState {
  /** Бэкап включён пользователем. */
  enabled: boolean;
  /** Время последней успешной загрузки, ms. */
  lastBackup?: number;
}

export function getDriveState(): DriveState {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{"enabled":false}');
  } catch {
    return { enabled: false };
  }
}

function saveState(s: DriveState) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
  window.dispatchEvent(new CustomEvent(DRIVE_EVENT));
}

export function onDriveChange(cb: () => void): () => void {
  window.addEventListener(DRIVE_EVENT, cb);
  return () => window.removeEventListener(DRIVE_EVENT, cb);
}

/* ===== Парольная фраза ===== */

/** Фраза лежит локально рядом с самой базой. Это осознанно: локальная БД и так
 *  хранится в IndexedDB в открытом виде, поэтому хранение фразы на том же
 *  устройстве не ослабляет модель — она защищает копию от Google и от нас, а не
 *  от того, у кого уже есть доступ к устройству. Без неё автобэкап работал бы
 *  только пока открыта вкладка. */
const PASS_KEY = 'thedad.drive.pass';

export function getDrivePassphrase(): string | null {
  try { return localStorage.getItem(PASS_KEY); } catch { return null; }
}

export function setDrivePassphrase(v: string | null) {
  try {
    if (v) localStorage.setItem(PASS_KEY, v);
    else localStorage.removeItem(PASS_KEY);
  } catch { /* приватный режим */ }
}

/* ===== Доступ ===== */

// Токен живёт только в памяти вкладки: он действует час, а хранение в
// localStorage расширяло бы поверхность утечки без всякой пользы.
let accessToken: string | null = null;
let tokenExpiresAt = 0;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gis = () => (window as any).google?.accounts?.oauth2;

function loadGis(): Promise<void> {
  if (gis()) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('Не удалось загрузить Google Identity'));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', fail);
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = fail;
    document.head.appendChild(s);
  });
}

/** Токен доступа к Диску. interactive=false пытается обновить согласие молча —
 *  это режим автобэкапа, который не должен выдёргивать пользователя диалогом. */
async function getToken(interactive: boolean): Promise<string> {
  if (!CLIENT_ID) throw new Error('Google-бэкап не настроен в этой сборке');
  if (accessToken && Date.now() < tokenExpiresAt - 60_000) return accessToken;
  return isExtension ? getTokenExtension(interactive) : getTokenWeb(interactive);
}

/** Расширение: скрипт Google Identity туда не загрузить — CSP расширения
 *  разрешает только собственный код. Зато у Chrome есть свой механизм входа:
 *  chrome.identity открывает окно Google и возвращает токен в адресе
 *  перенаправления. Адрес вида https://<id>.chromiumapp.org/ должен быть в
 *  списке разрешённых у того же OAuth-клиента (см. DEPLOY.md). */
async function getTokenExtension(interactive: boolean): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const identity = (globalThis as any).chrome?.identity;
  if (!identity?.launchWebAuthFlow) throw new Error('В этой версии Chrome вход через Google недоступен');
  const redirect = identity.getRedirectURL() as string;
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.searchParams.set('client_id', CLIENT_ID);
  url.searchParams.set('response_type', 'token');
  url.searchParams.set('redirect_uri', redirect);
  url.searchParams.set('scope', SCOPE);
  if (interactive) url.searchParams.set('prompt', 'consent');

  const back: string | undefined = await identity.launchWebAuthFlow({ url: url.toString(), interactive });
  if (!back) throw new Error('Окно доступа закрыто');
  const params = new URLSearchParams(new URL(back).hash.slice(1));
  const token = params.get('access_token');
  if (!token) throw new Error(params.get('error_description') || params.get('error') || 'Доступ к Google Диску не выдан');
  accessToken = token;
  tokenExpiresAt = Date.now() + Number(params.get('expires_in') ?? 3600) * 1000;
  return token;
}

/** Веб и десктоп: Google Identity Services, токен без client secret. */
async function getTokenWeb(interactive: boolean): Promise<string> {
  await loadGis();
  const oauth2 = gis();
  if (!oauth2) throw new Error('Google Identity недоступен');

  return new Promise<string>((resolve, reject) => {
    const client = oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      callback: (resp: any) => {
        if (resp?.error || !resp?.access_token) {
          reject(new Error(resp?.error_description || 'Доступ к Google Диску не выдан'));
          return;
        }
        accessToken = resp.access_token as string;
        tokenExpiresAt = Date.now() + Number(resp.expires_in ?? 3600) * 1000;
        resolve(accessToken);
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      error_callback: (err: any) => reject(new Error(err?.message || 'Окно доступа закрыто')),
    });
    // Пустой prompt переиспользует уже выданное согласие, без нового диалога.
    client.requestAccessToken({ prompt: interactive ? 'consent' : '' });
  });
}

async function api(url: string, init: RequestInit = {}, interactive = true): Promise<Response> {
  const token = await getToken(interactive);
  const headers = { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` };
  const res = await fetch(url, { ...init, headers });
  if (res.status === 401) {
    accessToken = null;
    throw new Error('Google отозвал доступ — подключитесь заново');
  }
  if (!res.ok) throw new Error(`Google Диск ответил ошибкой ${res.status}`);
  return res;
}

/* ===== Файлы ===== */

export interface DriveBackup {
  id: string;
  name: string;
  createdTime: string;
  size: number;
}

export async function listDriveBackups(interactive = true): Promise<DriveBackup[]> {
  const url = `${FILES_API}?spaces=appDataFolder&orderBy=createdTime desc&pageSize=50&fields=files(id,name,createdTime,size)`;
  const res = await api(url, {}, interactive);
  const data = await res.json();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data.files ?? []).map((f: any) => ({
    id: f.id,
    name: f.name,
    createdTime: f.createdTime,
    size: Number(f.size ?? 0),
  }));
}

async function deleteDriveFile(id: string) {
  await api(`${FILES_API}/${id}`, { method: 'DELETE' });
}

/** Шифрует текущую БД и заливает в appDataFolder, подчищая старые копии. */
export async function uploadBackup(passphrase: string, interactive = true): Promise<DriveBackup> {
  await persist();
  const bytes = await get<Uint8Array>(DB_KEY);
  if (!bytes) throw new Error('Локальной базы нет');
  const cipher = await encryptBytes(bytes, passphrase);

  const name = `thedad-${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite.enc`;
  const boundary = `tdd${crypto.randomUUID()}`;
  const meta = JSON.stringify({ name, parents: ['appDataFolder'], mimeType: 'application/octet-stream' });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
    `--${boundary}\r\nContent-Type: application/octet-stream\r\n\r\n`,
    cipher as BlobPart,
    `\r\n--${boundary}--`,
  ]);

  const res = await api(
    `${UPLOAD_API}?uploadType=multipart&fields=id,name,createdTime,size`,
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body },
    interactive,
  );
  const f = await res.json();

  saveState({ ...getDriveState(), enabled: true, lastBackup: Date.now() });

  // Кольцо: держим только KEEP последних копий, иначе Диск копит их бесконечно.
  try {
    const all = await listDriveBackups(false);
    for (const old of all.slice(KEEP)) await deleteDriveFile(old.id);
  } catch {
    // Чистка не критична: копия уже загружена, это главное.
  }

  return { id: f.id, name: f.name, createdTime: f.createdTime, size: Number(f.size ?? cipher.length) };
}

/** Скачивает копию, расшифровывает и заменяет локальную БД.
 *  Текущее состояние предварительно уходит в локальный снимок. */
export async function restoreFromDrive(fileId: string, passphrase: string): Promise<void> {
  const res = await api(`${FILES_API}/${fileId}?alt=media`);
  const cipher = new Uint8Array(await res.arrayBuffer());
  // Расшифровываем ДО подмены: неверная фраза не должна стоить текущих данных.
  const plain = await decryptBytes(cipher, passphrase).catch(() => {
    throw new Error('Неверная парольная фраза или файл повреждён');
  });
  const current = await get<Uint8Array>(DB_KEY);
  if (current) await saveBackup(current, 'pre-restore');
  await set(DB_KEY, plain);
}

/** Отключает бэкап локально. Файлы в Диске остаются — их удаляет пользователь. */
export function disableDriveBackup() {
  accessToken = null;
  setDrivePassphrase(null);
  saveState({ enabled: false });
}

/** Суточный автобэкап без диалогов: если согласие ещё живо — заливаем молча,
 *  если Google его отозвал, тихо пропускаем до следующего ручного входа. */
export async function autoDriveBackup(passphrase: string | null): Promise<void> {
  const st = getDriveState();
  if (!st.enabled || !passphrase || !driveConfigured()) return;
  if (Date.now() - (st.lastBackup ?? 0) < AUTO_EVERY_MS) return;
  try {
    await uploadBackup(passphrase, false);
  } catch {
    // Молчим: автобэкап не повод показывать ошибку поверх работы.
  }
}
