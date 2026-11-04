/**
 * Маркетплейс премиум-«Программ» — направляемых многонедельных курсов
 * (питание + тренировки + цели + привычки + задачи по дням), которые при установке
 * разворачиваются во все системы приложения.
 *
 * Монетизация без сервера (см. docs/MARKETPLACE.md): паки лежат ЗАШИФРОВАННЫМИ
 * (`/marketplace/<id>.pack`, AES-256-GCM). Оплата на внешней странице (buyUrl) выдаёт
 * ЛИЦЕНЗ-КЛЮЧ — токен с Ed25519-подписью продавца, внутри — ключ расшифровки нужных паков.
 * Приложение проверяет подпись встроенным публичным ключом и расшифровывает пак локально.
 * Защита «лёгкая» (как чек): ключ можно переслать, но случайное копирование .pack бесполезно.
 *
 * Ничего не исполняется: расшифрованный пак — это декларативные данные (как шаблоны/плагины),
 * которые проходят через addGoal/addTask/addHabit и валидацию плагинов.
 */
import { isoDate, todayISO } from './utils';
import type { GoalTpl, HabitTpl, TaskTpl } from './templates';
import type { TimeBlock } from './types';
import { installPlugin, validatePlugin, PLUGINS_EVENT, type PluginWidgetDef } from './plugins';

/* ==================== Публичный ключ продавца ====================
 * Сгенерировать своей парой: `node scripts/gen-keypair.mjs` → вставить сюда base64
 * публичного ключа. Приватный ключ НИКОГДА не попадает в приложение (лежит в secrets/). */
export const MARKETPLACE_PUBLIC_KEY = 'Cti62oicA1LLOL8ycMtA8KfN2Vt7NzfLhk3s1nRbJUA=';

/* ==================== Форматы ==================== */

export const PROGRAM_SCHEMA = 'thedad.program/v1';

/** Задача программы: как в шаблонах, но с day_offset (через сколько дней от установки). */
export interface ProgramTask extends TaskTpl {
  day_offset?: number;
}

/** Блюдо дня в плеере. photo — dataURL (вшит в пак, приватен) или локальный путь. */
export interface ProgramMeal {
  meal: string;          // «Завтрак»
  title: string;
  kcal?: number;
  photo?: string;        // data:… или /marketplace/…
  recipe?: string;       // пошаговый рецепт
  video?: string;        // YouTube (id или ссылка)
}

export interface ProgramExercise {
  name: string;
  reps?: string;         // «3×12» или «45 сек»
  detail?: string;
  photo?: string;
  video?: string;        // YouTube-демо техники
}

export interface ProgramWorkout {
  title: string;
  note?: string;
  video?: string;        // общий YouTube-ролик тренировки
  exercises?: ProgramExercise[];
}

/** Один день направляемого курса — то, что показывает Программа-плеер. */
export interface ProgramDay {
  day: number;           // 1..N
  title?: string;        // «День 1 · Старт»
  lesson?: string;       // короткий урок/мотивация на день
  meals?: ProgramMeal[];
  workout?: ProgramWorkout;
  focusHabits?: string[]; // на какие привычки сделать акцент сегодня (по названию)
}

/* ── Премиум фитнес-хаб (кинематографичный экран занятий, как в example) ── */

export interface WorkoutSession {
  id: string;
  title: string;         // «Gym | Leg Workout»
  type: string;          // «Strength» | «Cardio» | «Yoga» | «Calisthenics» …
  duration: string;      // «1 час», «45 мин»
  photo?: string;        // dataURL/локальный путь
  video?: string;        // YouTube
  note?: string;
  exercises?: ProgramExercise[];
}

/** День недельного расписания хаба: ссылается на сессии по id. */
export interface HubScheduleDay {
  label: string;         // «Пн», «Вт» …
  sessions: string[];    // id сессий из WorkoutHub.sessions
}

export interface WorkoutHub {
  hero?: string;         // фон-герой (dataURL/локальный)
  headline: string;      // «be the best you can be»
  quote?: string;
  goals?: string[];      // чек-лист целей
  sessions: WorkoutSession[];
  schedule?: HubScheduleDay[];
}

/** Расшифрованный пак-программа. Только данные, без кода. */
export interface ProgramPack {
  schema: typeof PROGRAM_SCHEMA;
  id: string;
  title: string;
  emoji: string;
  /** Длительность курса в днях (для «День X из N»). По умолчанию — макс. day в days[]. */
  duration_days?: number;
  goals?: GoalTpl[];
  habits?: HabitTpl[];
  tasks?: ProgramTask[];
  /** Опционально — виджет-плагин программы (например, план питания на месяц). */
  plugin?: PluginWidgetDef;
  /** Направляемый курс по дням — ядро премиум-опыта (плеер). */
  days?: ProgramDay[];
  /** Премиум фитнес-хаб — кинематографичный экран занятий спортом. */
  hub?: WorkoutHub;
}

/* ==================== Санитайзинг медиа (пак расшифрован, но перестрахуемся) ==================== */

/** Фото: только data:image или локальный путь (внешние URL = утечка/трекинг). */
export function safePhoto(v: string | undefined): string {
  if (!v) return '';
  if (/^data:image\//.test(v)) return v;
  if (/^\/(?!\/)[\w\-./]+$/.test(v)) return v;
  return '';
}

/** Достаём YouTube-id из id или любой ссылки. Только YouTube, без произвольных iframe. */
export function youtubeId(v: string | undefined): string {
  if (!v) return '';
  if (/^[\w-]{11}$/.test(v)) return v;
  const m = v.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : '';
}

/** Карточка витрины (публичная, лежит в открытом catalog.json — покупать нечего, пока не куплено). */
export interface CatalogItem {
  id: string;
  title: string;
  emoji: string;
  /** Что открывать по «Открыть»: 'program' (плеер по дням) или 'hub' (фитнес-зал). */
  kind?: 'program' | 'hub';
  /** Отображаемая цена, например "299 ₽". Реальная оплата — на buyUrl. */
  price: string;
  tagline: string;
  description: string;
  weeks?: number;
  /** Что входит — маркированный список для превью. */
  includes?: string[];
  /** Локальная картинка-превью ("/marketplace/preview/...") — внешние URL не грузим. */
  preview?: string;
  /** Внешняя страница оплаты (Boosty/ЮKassa/…), которая выдаёт лиценз-ключ. */
  buyUrl: string;
}

export interface Catalog {
  items: CatalogItem[];
}

/** Do not send users to incomplete or non-HTTPS payment links. */
export function purchaseUrl(value: unknown): string | null {
  if (typeof value !== 'string' || /change[_-]?me|placeholder|example\.com/i.test(value)) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Действия стора, нужные для установки программы (передаёт React-модалка из useStore). */
export interface ProgramActions {
  batch: (fn: () => void) => void;
  addGoal: (g: { title: string; type: GoalTpl['type']; start_value: number; target_value: number; unit: string | null; deadline: string | null }) => void;
  addHabit: (h: { title: string; color: string | null; schedule: 'daily' | 'weekly'; target_per_week: number }) => void;
  addTask: (t: { title: string; date: string; time_block: TimeBlock | null; start_time: string | null; priority: number; tags: string | null; estimate_min: number | null }) => void;
}

/* ==================== Событие открытия витрины ==================== */

export const MARKETPLACE_EVENT = 'thedad:marketplace';
export const openMarketplace = () => window.dispatchEvent(new CustomEvent(MARKETPLACE_EVENT));

/* ==================== base64 / utf8 хелперы ==================== */

function fromB64(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

/* ==================== Каталог ==================== */

export async function fetchCatalog(): Promise<Catalog> {
  const resp = await fetch('/marketplace/catalog.json', { cache: 'no-cache' });
  if (!resp.ok) throw new Error('Не удалось загрузить каталог');
  const data = await resp.json();
  if (!Array.isArray(data?.items)) throw new Error('Некорректный каталог');
  return { items: data.items.filter((i: any) => i && typeof i.id === 'string') };
}

/* ==================== Лицензии ====================
 * Формат ключа: THEDAD-<base64url(payloadJSON)>.<base64url(signature)>
 * payload = { v:1, packs: { [packId]: contentKeyB64 }, buyer?, iat } */

const LICENSE_STORE = 'marketplace.licenses.v1';
export const LICENSES_EVENT = 'thedad:licenses-changed';

interface LicensePayload {
  v: number;
  packs: Record<string, string>;
  buyer?: string;
  iat?: number;
}

function ownedMap(strict = false): Record<string, string> {
  try {
    const m = JSON.parse(localStorage.getItem(LICENSE_STORE) || '{}');
    if (!m || typeof m !== 'object' || Array.isArray(m) || !Object.entries(m).every(([id, key]) => /^[a-z0-9][a-z0-9-]{1,63}$/.test(id) && typeof key === 'string')) throw new Error('invalid');
    return m;
  } catch {
    if (strict) throw new Error('Данные лицензий повреждены или недоступны. Они не изменены; сохраните их перед восстановлением и подготовьте исходные ключи активации.');
    return {};
  }
}

export function ownedPackIds(): string[] {
  return Object.keys(ownedMap());
}

export function isOwned(id: string): boolean {
  return id in ownedMap();
}

function getContentKey(id: string): string | null {
  return ownedMap()[id] ?? null;
}

function parseLicense(raw: string): { payloadBytes: Uint8Array; payload: LicensePayload; sig: Uint8Array } {
  const s = raw.trim().replace(/^THEDAD-/i, '');
  const dot = s.indexOf('.');
  if (dot < 0) throw new Error('Ключ повреждён (нет разделителя)');
  const payloadBytes = fromB64(s.slice(0, dot));
  const sig = fromB64(s.slice(dot + 1));
  let payload: LicensePayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(payloadBytes));
  } catch {
    throw new Error('Ключ повреждён (не читается содержимое)');
  }
  if (!payload || typeof payload !== 'object' || !payload.packs || typeof payload.packs !== 'object') {
    throw new Error('Ключ не содержит паков');
  }
  return { payloadBytes, payload, sig };
}

/** Проверить и активировать лиценз-ключ. Возвращает id разблокированных паков.
 *  Бросает Error с понятным текстом, если подпись неверна или ключ повреждён. */
export async function redeemLicense(raw: string, publicKeyB64: string = MARKETPLACE_PUBLIC_KEY): Promise<string[]> {
  // Ключ параметром — только ради тестов: боевой приватный ключ в тесты не
  // попадает, там подписываем временной парой. В приложении всегда боевой.
  if (publicKeyB64.startsWith('REPLACE_')) {
    throw new Error('Маркетплейс ещё не настроен (нет публичного ключа)');
  }
  const { payloadBytes, payload, sig } = parseLicense(raw);
  const pub = fromB64(publicKeyB64);
  // Библиотека подписи нужна только здесь — при вводе ключа. Статический
  // импорт тянул её в стартовый бандл каждому пользователю.
  const ed = await import('@noble/ed25519');
  let ok = false;
  try {
    ok = await ed.verifyAsync(sig, payloadBytes, pub);
  } catch {
    ok = false;
  }
  if (!ok) throw new Error('Неверный ключ — подпись не совпадает');

  const map = ownedMap(true);
  const unlocked: string[] = [];
  for (const [id, key] of Object.entries(payload.packs)) {
    if (typeof key === 'string' && /^[a-z0-9][a-z0-9-]{1,63}$/.test(id)) {
      map[id] = key;
      unlocked.push(id);
    }
  }
  if (unlocked.length === 0) throw new Error('В ключе нет допустимых паков');
  localStorage.setItem(LICENSE_STORE, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(LICENSES_EVENT));
  return unlocked;
}

/* ==================== Расшифровка и установка пака ==================== */

interface PackFile {
  v: number;
  iv: string; // base64
  ct: string; // base64, ciphertext||tag
}

/** Скачать зашифрованный пак и расшифровать ключом из лицензии. */
export async function fetchProgram(id: string): Promise<ProgramPack> {
  const key = getContentKey(id);
  if (!key) throw new Error('Для открытия программы активируйте её лицензионный ключ.');
  const resp = await fetch(`/marketplace/${id}.pack`, { cache: 'no-cache' });
  if (!resp.ok) throw new Error('Файл программы не найден');
  const file = (await resp.json()) as PackFile;
  if (!file?.iv || !file?.ct) throw new Error('Файл программы повреждён');

  let json: string;
  try {
    const cryptoKey = await crypto.subtle.importKey('raw', fromB64(key) as BufferSource, 'AES-GCM', false, ['decrypt']);
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(file.iv) as BufferSource }, cryptoKey, fromB64(file.ct) as BufferSource);
    json = new TextDecoder().decode(pt);
  } catch {
    throw new Error('Не удалось расшифровать — ключ не подходит к этому паку');
  }

  let pack: ProgramPack;
  try {
    pack = JSON.parse(json);
  } catch {
    throw new Error('Программа повреждена');
  }
  if (pack?.schema !== PROGRAM_SCHEMA || pack.id !== id) throw new Error('Неверный формат программы');
  return pack;
}

/** Развернуть программу в стор: цели, привычки, задачи (по дням), плагин. */
export function applyProgram(pack: ProgramPack, actions: ProgramActions): number {
  if (installedPrograms(true).some((p) => p.id === pack.id)) throw new Error('Программа уже установлена. Откройте её из списка программ.');
  allProgress(true);
  // SQLite и localStorage не имеют общей транзакции. При синхронной ошибке
  // откатываем SQLite через batch и возвращаем прежние значения localStorage.
  const keys = ['plugins.installed.v1', 'program.installed.v1', 'program.progress.v1'];
  const before = keys.map((key) => [key, localStorage.getItem(key)] as const);
  try {
    let count = 0;
    actions.batch(() => { count = applyProgramContents(pack, actions); });
    return count;
  } catch (error) {
    let restored = true;
    for (const [key, value] of before) {
      try {
        if (value === null) localStorage.removeItem(key);
        else localStorage.setItem(key, value);
      } catch { restored = false; }
    }
    window.dispatchEvent(new CustomEvent(PROGRAMS_EVENT));
    window.dispatchEvent(new CustomEvent(PLUGINS_EVENT));
    if (!restored) throw new Error('Не удалось полностью восстановить данные программы после ошибки. Проверьте резервную копию.');
    throw error;
  }
}

function applyProgramContents(pack: ProgramPack, actions: ProgramActions): number {
  let count = 0;
  const dayISO = (offset: number): string => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return isoDate(d);
  };

  pack.goals?.forEach((g) => {
    actions.addGoal({
      title: g.title,
      type: g.type,
      start_value: g.start_value,
      target_value: g.target_value,
      unit: g.unit ?? null,
      deadline: g.deadline_in_days
        ? dayISO(g.deadline_in_days)
        : null,
    });
    count++;
  });
  pack.habits?.forEach((h) => {
    actions.addHabit({
      title: h.title,
      color: h.color ?? null,
      schedule: h.schedule ?? 'daily',
      target_per_week: h.target_per_week ?? 7,
    });
    count++;
  });
  pack.tasks?.forEach((t) => {
    actions.addTask({
      title: t.title,
      date: dayISO(t.day_offset ?? 0),
      time_block: t.time_block ?? null,
      start_time: t.start_time ?? null,
      priority: t.priority ?? 3,
      tags: t.tags ?? null,
      estimate_min: t.estimate_min ?? null,
    });
    count++;
  });
  if (pack.plugin && validatePlugin(pack.plugin).ok) {
    installPlugin(pack.plugin);
    count++;
  }
  markInstalled(pack);
  ensureProgramStart(pack.id);
  return count;
}

/* ==================== Установленные программы + прогресс плеера ==================== */

const INSTALLED_KEY = 'program.installed.v1';
const PROGRESS_KEY = 'program.progress.v1';
export const PROGRAM_OPEN_EVENT = 'thedad:program-open';
export const PROGRAMS_EVENT = 'thedad:programs-changed';

export const openProgram = (id: string) =>
  window.dispatchEvent(new CustomEvent(PROGRAM_OPEN_EVENT, { detail: { id } }));

export const PROGRAM_HUB_EVENT = 'thedad:workout-hub';
export const openWorkoutHub = (id: string) =>
  window.dispatchEvent(new CustomEvent(PROGRAM_HUB_EVENT, { detail: { id } }));

/** Стрик тренировок: подряд идущих дней (с сегодня или вчера) с логом metric 'workout'. */
export function workoutStreak(healthLogs: { metric: string; date: string; value: number }[]): number {
  const days = new Set(healthLogs.filter((l) => l.metric === 'workout' && l.value > 0).map((l) => l.date));
  if (days.size === 0) return 0;
  const iso = isoDate;
  const today = new Date(new Date().toDateString());
  // старт стрика: сегодня, если тренировался, иначе вчера (день ещё «не закрыт»)
  const cur = new Date(today);
  if (!days.has(iso(cur))) cur.setDate(cur.getDate() - 1);
  let streak = 0;
  while (days.has(iso(cur))) {
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/** Лёгкая мета установленной программы — чтобы виджет знал title/emoji/kind без расшифровки. */
export interface InstalledProgram {
  id: string;
  title: string;
  emoji: string;
  kind: 'program' | 'hub';
}

export function installedPrograms(strict = false): InstalledProgram[] {
  try {
    const l = JSON.parse(localStorage.getItem(INSTALLED_KEY) || '[]');
    if (!Array.isArray(l) || !l.every((x) => typeof x === 'string' || (x && typeof x === 'object' && !Array.isArray(x) && typeof x.id === 'string' && (x.title == null || typeof x.title === 'string') && (x.emoji == null || typeof x.emoji === 'string') && (x.kind == null || x.kind === 'hub' || x.kind === 'program')))) throw new Error('invalid');
    // Миграция со старого формата (массив строк)
    return l
      .map((x): InstalledProgram | null =>
        typeof x === 'string'
          ? { id: x, title: x, emoji: '🎯', kind: 'program' }
          : (x && typeof x.id === 'string' ? { id: x.id, title: x.title ?? x.id, emoji: x.emoji ?? '🎯', kind: x.kind === 'hub' ? 'hub' : 'program' } : null))
      .filter((x): x is InstalledProgram => x !== null);
  } catch {
    if (strict) throw new Error('Список программ повреждён или недоступен. Данные не изменены; восстановите резервную копию.');
    return [];
  }
}

export function installedProgramIds(): string[] {
  return installedPrograms().map((p) => p.id);
}

export function isInstalled(id: string): boolean {
  return installedProgramIds().includes(id);
}

function markInstalled(pack: ProgramPack) {
  const list = installedPrograms(true).filter((p) => p.id !== pack.id);
  list.push({ id: pack.id, title: pack.title, emoji: pack.emoji, kind: pack.hub ? 'hub' : 'program' });
  localStorage.setItem(INSTALLED_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(PROGRAMS_EVENT));
}

interface ProgressState {
  start: string;         // ISO дата старта
  done: number[];        // отмеченные дни
}

function allProgress(strict = false): Record<string, ProgressState> {
  try {
    const m = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    if (!m || typeof m !== 'object' || Array.isArray(m) || !Object.values(m).every((item: any) => item && typeof item === 'object' && !Array.isArray(item) && typeof item.start === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.start) && Array.isArray(item.done) && item.done.every((day: unknown) => Number.isSafeInteger(day) && (day as number) > 0))) throw new Error('invalid');
    return m;
  } catch {
    if (strict) throw new Error('Прогресс программ повреждён или недоступен. Данные не изменены; восстановите резервную копию.');
    return {};
  }
}

function saveProgress(m: Record<string, ProgressState>) {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(m));
  window.dispatchEvent(new CustomEvent(PROGRAMS_EVENT));
}

/** Зафиксировать дату старта при первой установке (для «День X из N»). */
export function ensureProgramStart(id: string) {
  const m = allProgress(true);
  if (!m[id]) {
    m[id] = { start: todayISO(), done: [] };
    saveProgress(m);
  }
}

export function getProgress(id: string): ProgressState {
  return allProgress()[id] ?? { start: todayISO(), done: [] };
}

/** Текущий день программы по календарю от старта (1..total, не цикличный). */
export function currentDay(id: string, total: number): number {
  const { start } = getProgress(id);
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const todayMs = new Date(new Date().toDateString()).getTime();
  const diff = Math.max(0, Math.round((todayMs - startMs) / 86400000));
  return Math.min(Math.max(1, total), diff + 1);
}

export function toggleDayDone(id: string, day: number) {
  const m = allProgress(true);
  const st = m[id] ?? { start: todayISO(), done: [] };
  const set = new Set(st.done);
  set.has(day) ? set.delete(day) : set.add(day);
  m[id] = { ...st, done: [...set].sort((a, b) => a - b) };
  saveProgress(m);
}
