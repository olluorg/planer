/** «Живые обои» приложения (для glass-темы): YouTube-видео или локальный видеофайл
 *  (mp4/webm, как в Lively Wallpaper). Конфиг — в localStorage, видео-блоб — в IndexedDB
 *  (idb-keyval), т.к. в localStorage он не влезет. Object URL пересоздаётся при загрузке. */
import { get, set, del } from 'idb-keyval';

export type LiveWallpaper =
  | { kind: 'youtube'; ref: string }   // ref = YouTube id
  | { kind: 'video'; ref: string };    // ref = ключ блоба в idb

const KEY = 'app.livewallpaper.v1';
const IDB_PREFIX = 'livewp:';
export const LIVEWP_EVENT = 'thedad:livewallpaper-changed';

export function getLiveWallpaper(): LiveWallpaper | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

function save(w: LiveWallpaper | null) {
  try { if (w) localStorage.setItem(KEY, JSON.stringify(w)); else localStorage.removeItem(KEY); } catch {}
  window.dispatchEvent(new CustomEvent(LIVEWP_EVENT));
}

export function setYouTubeWallpaper(id: string) {
  save({ kind: 'youtube', ref: id });
}

/** Сохраняет видеофайл в IndexedDB и делает его живыми обоями. */
export async function setVideoWallpaper(file: File): Promise<void> {
  const ref = `${IDB_PREFIX}${Date.now().toString(36)}`;
  await set(ref, file);
  // подчищаем прежний видео-блоб, если был
  const prev = getLiveWallpaper();
  if (prev?.kind === 'video' && prev.ref !== ref) { try { await del(prev.ref); } catch {} }
  save({ kind: 'video', ref });
}

export async function clearLiveWallpaper(): Promise<void> {
  const prev = getLiveWallpaper();
  if (prev?.kind === 'video') { try { await del(prev.ref); } catch {} }
  save(null);
}

/** Object URL для видео-обоев из idb (null, если нет). Освобождать через revoke по надобности. */
export async function loadVideoWallpaperUrl(ref: string): Promise<string | null> {
  try {
    const blob = await get<Blob>(ref);
    return blob ? URL.createObjectURL(blob) : null;
  } catch { return null; }
}
