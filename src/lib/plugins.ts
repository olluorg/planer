/**
 * Плагины-виджеты, уровень A по docs/PLUGINS_SPEC.md: декларативный JSON без
 * исполняемого кода. Плагин описывает ОТКУДА взять данные (белый список коллекций
 * стора, read-only) и КАК показать (фиксированный набор примитивов). Никакого
 * eval/выражений — только имена полей и значения из белых списков.
 */
import { isoDate } from './utils';

/* ==================== Формат и белые списки ==================== */

export const PLUGIN_SCHEMA = 'thedad.widget/v1';

/** Коллекции стора, которые видит плагин (read-only, копии). AI-ключ, синк, шифрование — никогда. */
export const PLUGIN_COLLECTIONS = [
  'goals', 'tasks', 'habits', 'habitLogs', 'healthLogs', 'progress', 'reflections', 'timeEntries',
] as const;
export type PluginCollection = typeof PLUGIN_COLLECTIONS[number];

export const PLUGIN_RANGES = ['today', 'last-7-days', 'last-30-days', 'last-90-days', 'all'] as const;
export type PluginRange = typeof PLUGIN_RANGES[number];

export const PLUGIN_RENDER_TYPES = ['stat', 'list', 'bar', 'line', 'ring', 'table', 'cards'] as const;
export type PluginRenderType = typeof PLUGIN_RENDER_TYPES[number];

/** Поле даты в каждой коллекции — по нему работает range/groupBy. */
const DATE_FIELD: Record<PluginCollection, string> = {
  goals: 'created_at',
  tasks: 'date',
  habits: 'created_at',
  habitLogs: 'date',
  healthLogs: 'date',
  progress: 'date',
  reflections: 'date',
  timeEntries: 'started_at',
};

export interface PluginSource {
  /** Данные из стора (read-only)… */
  collection?: PluginCollection;
  range?: PluginRange;            // по умолчанию 'last-30-days'
  groupBy?: 'date';               // группировка для bar/line
  /** Простой фильтр равенства: { status: 'done' }. Только поле → значение, без выражений. */
  where?: Record<string, string | number | null>;
  /** …ИЛИ статичные данные, встроенные прямо в плагин (контентные виджеты:
   *  рецепты, тренировки, чек-листы). Просто массив записей, без кода. */
  static?: Record<string, string | number | null>[];
}

export interface PluginRender {
  type: PluginRenderType;
  /** 'count' или имя числового поля (sum по группе / значение записи). */
  value?: string;
  /** Подпись строки: шаблон с {{field}} (простая подстановка, без eval). */
  label?: string;
  /** ring: чему равны 100% (число). stat: целевое значение для подписи. */
  max?: number;
  /** table: список колонок (имена полей). */
  columns?: string[];
  /* — только для type "cards" — */
  /** Краткий текст на лицевой стороне карточки (шаблон). */
  text?: string;
  /** Текст обратной стороны — открывается по клику (шаблон), например рецепт. */
  detail?: string;
  /** Имя поля с картинкой. Только локальные пути ("/food/…"), внешние URL запрещены. */
  image?: string;
  /** Маленькая подпись-бейдж сверху карточки (шаблон), например «Завтрак». */
  badge?: string;
  /** Имя числового поля «день»: виджет показывает карточки текущего дня месяца (циклично). */
  dayField?: string;
}

export interface PluginWidgetDef {
  schema: typeof PLUGIN_SCHEMA;
  id: string;                     // уникальный slug: [a-z0-9-]
  name: string;
  author?: string;
  icon?: string;                  // имя lucide-иконки из белого списка (см. PluginWidget.tsx)
  defaultSize?: { w: number; h: number };
  source: PluginSource;
  render: PluginRender;
}

/* ==================== Валидация импорта (без исполнения) ==================== */

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}$/;

export function validatePlugin(raw: unknown): { ok: true; plugin: PluginWidgetDef } | { ok: false; errors: string[] } {
  const errors: string[] = [];
  const p = raw as Partial<PluginWidgetDef> | null;
  if (!p || typeof p !== 'object') return { ok: false, errors: ['Файл не является JSON-объектом'] };
  if (p.schema !== PLUGIN_SCHEMA) errors.push(`schema должна быть "${PLUGIN_SCHEMA}"`);
  if (typeof p.id !== 'string' || !SLUG_RE.test(p.id)) errors.push('id — slug из a-z, 0-9 и дефисов (2–64 символа)');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 80) errors.push('name — непустая строка до 80 символов');
  if (p.author != null && typeof p.author !== 'string') errors.push('author — строка');
  if (p.icon != null && (typeof p.icon !== 'string' || !/^[a-z-]{2,32}$/.test(p.icon))) errors.push('icon — имя lucide-иконки строчными буквами');
  if (p.defaultSize != null) {
    const s = p.defaultSize;
    if (typeof s !== 'object' || typeof s.w !== 'number' || typeof s.h !== 'number' || s.w < 2 || s.w > 12 || s.h < 2 || s.h > 12) {
      errors.push('defaultSize — { w: 2..12, h: 2..12 }');
    }
  }
  const src = p.source as PluginSource | undefined;
  const r0 = p.render as PluginRender | undefined;
  if (!src || typeof src !== 'object') errors.push('source обязателен');
  else if (src.static != null) {
    // Контентный плагин: данные встроены. Никаких выражений — просто записи из примитивов.
    if (src.collection != null || src.range != null || src.groupBy != null || src.where != null) {
      errors.push('source.static не сочетается с collection/range/groupBy/where');
    }
    if (!Array.isArray(src.static) || src.static.length === 0 || src.static.length > 500) {
      errors.push('source.static — массив из 1..500 записей');
    } else {
      const imageField = r0 && typeof r0 === 'object' ? r0.image : undefined;
      for (const [i, row] of src.static.entries()) {
        if (!row || typeof row !== 'object' || Array.isArray(row)) { errors.push(`source.static[${i}] — объект`); break; }
        for (const [k, v] of Object.entries(row)) {
          if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) { errors.push(`source.static[${i}]: недопустимое имя поля "${k}"`); break; }
          if (v !== null && typeof v !== 'string' && typeof v !== 'number') { errors.push(`source.static[${i}].${k} — строка, число или null`); break; }
          if (typeof v === 'string' && v.length > 4000) { errors.push(`source.static[${i}].${k} — строка до 4000 символов`); break; }
          // Картинки — только локальные пути: внешний URL = утечка (IP, трекинг).
          // (?!\/) отсекает protocol-relative "//evil.com/…"
          if (imageField && k === imageField && typeof v === 'string' && v !== '' && !/^\/(?!\/)[\w\-./]+$/.test(v)) {
            errors.push(`source.static[${i}].${k} — картинка только локальным путём вида "/food/img.jpg"`);
            break;
          }
        }
        if (errors.length) break;
      }
    }
  } else {
    if (!src.collection || !PLUGIN_COLLECTIONS.includes(src.collection)) errors.push(`source.collection — одно из: ${PLUGIN_COLLECTIONS.join(', ')} (или source.static)`);
    if (src.range != null && !PLUGIN_RANGES.includes(src.range)) errors.push(`source.range — одно из: ${PLUGIN_RANGES.join(', ')}`);
    if (src.groupBy != null && src.groupBy !== 'date') errors.push("source.groupBy — только 'date'");
    if (src.where != null) {
      if (typeof src.where !== 'object' || Array.isArray(src.where)) errors.push('source.where — объект { поле: значение }');
      else for (const [k, v] of Object.entries(src.where)) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) errors.push(`source.where: недопустимое имя поля "${k}"`);
        if (v !== null && typeof v !== 'string' && typeof v !== 'number') errors.push(`source.where.${k} — строка, число или null`);
      }
    }
  }
  const r = p.render as PluginRender | undefined;
  if (!r || typeof r !== 'object') errors.push('render обязателен');
  else {
    if (!PLUGIN_RENDER_TYPES.includes(r.type)) errors.push(`render.type — одно из: ${PLUGIN_RENDER_TYPES.join(', ')}`);
    if (r.value != null && (typeof r.value !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(r.value) && r.value !== 'count')) errors.push('render.value — "count" или имя поля');
    if (r.label != null && (typeof r.label !== 'string' || r.label.length > 120)) errors.push('render.label — строка до 120 символов');
    if (r.max != null && (typeof r.max !== 'number' || !(r.max > 0))) errors.push('render.max — положительное число');
    if (r.columns != null && (!Array.isArray(r.columns) || r.columns.length === 0 || r.columns.length > 6
      || r.columns.some((c) => typeof c !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(c)))) {
      errors.push('render.columns — 1..6 имён полей');
    }
    if (r?.type === 'table' && !r.columns?.length) errors.push('render.columns обязателен для type "table"');
    // Поля карточек — шаблоны/имена полей, без выражений
    for (const key of ['text', 'detail', 'badge'] as const) {
      if (r[key] != null && (typeof r[key] !== 'string' || (r[key] as string).length > 200)) errors.push(`render.${key} — строка-шаблон до 200 символов`);
    }
    for (const key of ['image', 'dayField'] as const) {
      if (r[key] != null && (typeof r[key] !== 'string' || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(r[key] as string))) errors.push(`render.${key} — имя поля`);
    }
    if (r?.type === 'cards' && !r.label) errors.push('render.label обязателен для type "cards"');
  }
  if (errors.length) return { ok: false, errors };
  // Пересобираем объект из известных полей — «лишние» ключи импорта отбрасываются
  const plugin: PluginWidgetDef = {
    schema: PLUGIN_SCHEMA,
    id: p.id!, name: p.name!.trim(),
    ...(p.author ? { author: p.author.slice(0, 80) } : {}),
    ...(p.icon ? { icon: p.icon } : {}),
    ...(p.defaultSize ? { defaultSize: { w: p.defaultSize.w, h: p.defaultSize.h } } : {}),
    source: src!.static
      ? { static: src!.static.map((row) => ({ ...row })) }
      : {
        collection: src!.collection,
        ...(src!.range ? { range: src!.range } : {}),
        ...(src!.groupBy ? { groupBy: src!.groupBy } : {}),
        ...(src!.where ? { where: { ...src!.where } } : {}),
      },
    render: {
      type: r!.type,
      ...(r!.value ? { value: r!.value } : {}),
      ...(r!.label ? { label: r!.label } : {}),
      ...(r!.max != null ? { max: r!.max } : {}),
      ...(r!.columns ? { columns: [...r!.columns] } : {}),
      ...(r!.text ? { text: r!.text } : {}),
      ...(r!.detail ? { detail: r!.detail } : {}),
      ...(r!.image ? { image: r!.image } : {}),
      ...(r!.badge ? { badge: r!.badge } : {}),
      ...(r!.dayField ? { dayField: r!.dayField } : {}),
    },
  };
  return { ok: true, plugin };
}

/* ==================== Хранение установленных ==================== */

const STORE_KEY = 'plugins.installed.v1';
export const PLUGINS_EVENT = 'thedad:plugins-changed';

export function getInstalledPlugins(): PluginWidgetDef[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORE_KEY) || '[]');
    return Array.isArray(list) ? list.filter((p) => validatePlugin(p).ok) : [];
  } catch { return []; }
}

function save(list: PluginWidgetDef[]) {
  localStorage.setItem(STORE_KEY, JSON.stringify(list));
  window.dispatchEvent(new CustomEvent(PLUGINS_EVENT));
}

/** Установка (или обновление по id). Бросает Error со списком проблем валидации. */
export function installPlugin(raw: unknown): PluginWidgetDef {
  const res = validatePlugin(raw);
  if (!res.ok) throw new Error(res.errors.join('; '));
  const list = getInstalledPlugins().filter((p) => p.id !== res.plugin.id);
  save([...list, res.plugin]);
  return res.plugin;
}

export function removePlugin(id: string) {
  save(getInstalledPlugins().filter((p) => p.id !== id));
}

/** Предустановленные плагины: ставятся один раз при первом запуске из статики приложения
 *  (same-origin, не сеть). Флаг не даёт переустановить то, что пользователь удалил сам. */
// v3: питание с типами блюд (kind), калориями и библиотекой напитков/десертов/снеков
const DEFAULTS_KEY = 'plugins.defaults.v3';
const DEFAULT_PLUGIN_FILES = ['/plugins/nutrition-month.thedad-widget.json'];

export async function ensureDefaultPlugins(): Promise<void> {
  try {
    if (localStorage.getItem(DEFAULTS_KEY) === '1') return;
    for (const url of DEFAULT_PLUGIN_FILES) {
      try {
        const resp = await fetch(url);
        if (resp.ok) installPlugin(await resp.json());
      } catch {}
    }
    localStorage.setItem(DEFAULTS_KEY, '1');
  } catch {}
}

/** Экспорт обратно в .json — шаринг без сервера. */
export function exportPlugin(p: PluginWidgetDef) {
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${p.id}.thedad-widget.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ==================== Данные: read-only выборка из стора ==================== */

/** Снимок разрешённых коллекций. Заполняется вызывающим из useStore (копии не нужны:
 *  плагин ничего не исполняет, а рендер работает по извлечённым примитивам). */
export type PluginDataSnapshot = Record<PluginCollection, Record<string, unknown>[]>;

export interface PluginRow {
  label: string;
  value: number;
  raw: Record<string, unknown>;
}

function rangeStart(range: PluginRange): string | null {
  const days = range === 'today' ? 0 : range === 'last-7-days' ? 6 : range === 'last-30-days' ? 29 : range === 'last-90-days' ? 89 : null;
  if (days === null) return null;
  return isoDate(new Date(Date.now() - days * 86400000));
}

function rowDate(row: Record<string, unknown>, field: string): string | null {
  const v = row[field];
  return typeof v === 'string' && v.length >= 10 ? v.slice(0, 10) : null;
}

/** Простая подстановка {{field}} — замена по ключам записи, без eval. */
export function renderTemplate(tpl: string, row: Record<string, unknown>): string {
  return tpl.replace(/\{\{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\}\}/g, (_, key) => {
    const v = row[key];
    return v == null ? '' : String(v);
  });
}

function numValue(row: Record<string, unknown>, field: string): number {
  const v = row[field];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** День меню для static-карточек: отсчитывается от ПЕРВОГО открытия виджета
 *  («месяц начинается сегодня»), дальше циклично по количеству дней в наборе. */
export function menuDay(maxDay: number, pluginId: string): number {
  if (maxDay <= 0) return 1;
  const key = `plugin.day-start.${pluginId}`;
  let start = '';
  try {
    start = localStorage.getItem(key) ?? '';
    if (!start) {
      start = isoDate(new Date());
      localStorage.setItem(key, start);
    }
  } catch { start = isoDate(new Date()); }
  const startMs = new Date(`${start}T00:00:00`).getTime();
  const todayMs = new Date(new Date().toDateString()).getTime();
  const diff = Math.max(0, Math.round((todayMs - startMs) / 86400000));
  return (diff % maxDay) + 1;
}

/** Выборка строк для рендера: фильтр по range/where, группировка, значение. */
export function selectRows(def: PluginWidgetDef, data: PluginDataSnapshot): PluginRow[] {
  // Статичные данные: без range/where; опционально фильтр «карточки текущего дня»
  if (def.source.static) {
    let rows: Record<string, unknown>[] = def.source.static;
    const dayField = def.render.dayField;
    if (dayField) {
      const maxDay = rows.reduce((m, r) => Math.max(m, Number(r[dayField]) || 0), 0);
      const day = menuDay(maxDay, def.id);
      rows = rows.filter((r) => Number(r[dayField]) === day);
    }
    const labelTpl = def.render.label ?? '';
    const valueField = def.render.value ?? 'count';
    return rows.map((r) => ({
      label: labelTpl ? renderTemplate(labelTpl, r) : '',
      value: valueField === 'count' ? 1 : numValue(r, valueField),
      raw: r,
    }));
  }

  const { collection = 'tasks', range = 'last-30-days', groupBy, where } = def.source;
  const dateField = DATE_FIELD[collection];
  const start = rangeStart(range);
  let rows = data[collection] ?? [];
  if (start) rows = rows.filter((r) => { const d = rowDate(r, dateField); return d != null && d >= start; });
  if (where) rows = rows.filter((r) => Object.entries(where).every(([k, v]) => r[k] === v));

  const valueField = def.render.value ?? 'count';
  const labelTpl = def.render.label ?? (groupBy === 'date' ? '{{date}}' : '');

  if (groupBy === 'date') {
    const groups = new Map<string, Record<string, unknown>[]>();
    for (const r of rows) {
      const d = rowDate(r, dateField) ?? '—';
      const g = groups.get(d);
      if (g) g.push(r); else groups.set(d, [r]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, items]) => ({
        label: labelTpl ? renderTemplate(labelTpl, { date }) : date,
        value: valueField === 'count' ? items.length : items.reduce((s, r) => s + numValue(r, valueField), 0),
        raw: { date, count: items.length },
      }));
  }

  return rows.map((r) => ({
    label: labelTpl ? renderTemplate(labelTpl, r) : '',
    value: valueField === 'count' ? 1 : numValue(r, valueField),
    raw: r,
  }));
}

/** Итог для stat/ring: count → число строк, поле → сумма. */
export function totalValue(def: PluginWidgetDef, rows: PluginRow[]): number {
  const valueField = def.render.value ?? 'count';
  if (def.source.groupBy === 'date') return rows.reduce((s, r) => s + r.value, 0);
  return valueField === 'count' ? rows.length : rows.reduce((s, r) => s + r.value, 0);
}
