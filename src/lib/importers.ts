/** Импорт задач из Todoist, TickTick и Google Tasks.
 *
 *  Главная причина не переходить в новый планер — «у меня там всё». Каждый из
 *  трёх сервисов умеет выгружать задачи в файл; здесь эти файлы разбираются в
 *  общий вид, а создаёт задачи уже вызывающий (после показа превью).
 *
 *  Разбор опирается на названия колонок и полей, а не на их порядок: сервисы
 *  добавляют колонки между версиями. Незнакомое — пропускается с предупреждением,
 *  а не роняет импорт целиком.
 *
 *  Форматы:
 *  - Todoist: экспорт проекта в CSV (TYPE, CONTENT, DESCRIPTION, PRIORITY,
 *    INDENT, DATE…). PRIORITY 4 — высший (p1 в интерфейсе), INDENT — вложенность.
 *  - TickTick: резервная копия CSV (Настройки → Резервная копия). Перед
 *    заголовком — служебные строки; Priority 0/1/3/5, Status 0 — активна.
 *  - Google Tasks: Google Takeout, файл Tasks.json.
 */
import { parseCsvRows } from './importCsv';
import type { Recurrence } from './types';

export type ImportSource = 'todoist' | 'ticktick' | 'google-tasks';

export interface ImportedTask {
  /** Идентификатор внутри файла — для связи подзадач с родителем. */
  key: string;
  parentKey: string | null;
  title: string;
  notes: string | null;
  /** YYYY-MM-DD или null — тогда задача ставится на сегодня. */
  date: string | null;
  /** HH:MM или null. */
  time: string | null;
  /** Наша шкала: 1 — срочно … 3 — обычная … 5 — фоновая. */
  priority: number;
  recurrence: Recurrence;
  done: boolean;
  /** Проект или список в исходном сервисе — станет тегом. */
  list: string | null;
}

export interface ImportResult {
  source: ImportSource;
  tasks: ImportedTask[];
  warnings: string[];
}

export class ImportFormatError extends Error {}

/* ===== общие помощники ===== */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})/;
const TIME = /(?:T|\s)(\d{2}):(\d{2})/;

function datePart(v: string | undefined | null): string | null {
  const m = v?.match(ISO_DATE);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function timePart(v: string | undefined | null): string | null {
  const m = v?.match(TIME);
  if (!m) return null;
  // Полночь в выгрузках почти всегда означает «без времени», а не 00:00.
  return m[1] === '00' && m[2] === '00' ? null : `${m[1]}:${m[2]}`;
}

/** RRULE (TickTick, Google) или слова (Todoist) → наши четыре правила. */
function recurrenceOf(v: string | undefined | null): Recurrence {
  if (!v) return null;
  const s = v.toUpperCase();
  if (s.includes('FREQ=DAILY') || /\bEVERY\s+DAY\b|\bDAILY\b|КАЖДЫЙ ДЕНЬ/.test(s)) return 'daily';
  if ((s.includes('FREQ=WEEKLY') && /BYDAY=MO,TU,WE,TH,FR(?!,)/.test(s)) || /\bEVERY\s+WEEKDAY\b|ПО БУДНЯМ/.test(s)) return 'weekdays';
  if ((s.includes('FREQ=WEEKLY') && /BYDAY=SA,SU|BYDAY=SU,SA/.test(s)) || /\bEVERY\s+WEEKEND\b|ПО ВЫХОДНЫМ/.test(s)) return 'weekends';
  if (s.includes('FREQ=WEEKLY') || /\bEVERY\s+WEEK\b|\bWEEKLY\b|КАЖДУЮ НЕДЕЛЮ/.test(s)) return 'weekly';
  return null;
}

/** Строка заголовка → индексы колонок по имени (без учёта регистра). */
function columns(header: string[]): (name: string) => number {
  const map = new Map(header.map((h, i) => [h.trim().toLowerCase(), i]));
  return (name) => map.get(name.toLowerCase()) ?? -1;
}

/* ===== Todoist ===== */

function parseTodoist(rows: string[][], warnings: string[]): ImportedTask[] {
  const col = columns(rows[0]);
  const [TYPE, CONTENT, DESCRIPTION, PRIORITY, INDENT, DATE] =
    ['TYPE', 'CONTENT', 'DESCRIPTION', 'PRIORITY', 'INDENT', 'DATE'].map(col);
  const out: ImportedTask[] = [];
  // Последняя задача на каждом уровне вложенности — родитель для следующего уровня.
  const lastAtIndent: string[] = [];
  let section: string | null = null;
  let skippedDates = 0;

  rows.slice(1).forEach((r, i) => {
    const type = (r[TYPE] ?? '').trim().toLowerCase();
    const content = (r[CONTENT] ?? '').trim();
    if (type === 'section') { section = content || null; return; }
    if (type !== 'task' || !content) return; // комментарии и пустые строки

    const indent = Math.max(1, Number(r[INDENT]) || 1);
    const key = `todoist-${i}`;
    lastAtIndent[indent] = key;
    lastAtIndent.length = indent + 1;

    const rawDate = (r[DATE] ?? '').trim();
    const date = datePart(rawDate);
    const recurrence = recurrenceOf(rawDate);
    if (rawDate && !date && !recurrence && !/^(today|сегодня)$/i.test(rawDate)) skippedDates++;

    // Todoist: 4 — высший (p1), 1 — без приоритета.
    const p = Number(r[PRIORITY]) || 1;
    out.push({
      key,
      parentKey: indent > 1 ? lastAtIndent[indent - 1] ?? null : null,
      title: content,
      notes: (r[DESCRIPTION] ?? '').trim() || null,
      date,
      time: timePart(rawDate),
      priority: p >= 4 ? 1 : p === 3 ? 2 : 3,
      recurrence,
      done: false, // Todoist выгружает только активные задачи
      list: section,
    });
  });
  if (skippedDates) warnings.push(`У ${skippedDates} задач срок записан словами, которые не разобрать, — они встанут на сегодня.`);
  return out;
}

/* ===== TickTick ===== */

function parseTickTick(rows: string[][]): ImportedTask[] {
  const headerAt = rows.findIndex((r) => r.some((c) => c.trim() === 'Title') && r.some((c) => c.trim() === 'List Name'));
  if (headerAt < 0) throw new ImportFormatError('В файле TickTick не найден заголовок таблицы');
  const col = columns(rows[headerAt]);
  const [LIST, TITLE, CONTENT, DUE, START, REPEAT, PRIORITY, STATUS, ID, PARENT, KIND] =
    ['List Name', 'Title', 'Content', 'Due Date', 'Start Date', 'Repeat', 'Priority', 'Status', 'taskId', 'parentId', 'Kind'].map(col);

  return rows.slice(headerAt + 1).flatMap((r, i) => {
    const title = (r[TITLE] ?? '').trim();
    if (!title) return [];
    if ((r[KIND] ?? '').trim().toUpperCase() === 'NOTE') return []; // заметки — не задачи
    const due = r[DUE] || r[START];
    const p = Number(r[PRIORITY]) || 0; // 0 нет, 1 низкий, 3 средний, 5 высокий
    return [{
      key: (r[ID] ?? '').trim() || `ticktick-${i}`,
      parentKey: (r[PARENT] ?? '').trim() || null,
      title,
      notes: (r[CONTENT] ?? '').trim() || null,
      date: datePart(due),
      time: timePart(due),
      priority: p >= 5 ? 2 : p === 1 ? 4 : 3,
      recurrence: recurrenceOf(r[REPEAT]),
      done: (r[STATUS] ?? '0').trim() !== '0',
      list: (r[LIST] ?? '').trim() || null,
    }];
  });
}

/* ===== Google Tasks (Takeout) ===== */

interface GTask { id?: string; title?: string; notes?: string; status?: string; due?: string; parent?: string; deleted?: boolean }
interface GList { title?: string; items?: GTask[] }

function parseGoogleTasks(json: unknown): ImportedTask[] {
  const lists = (json as { items?: GList[] })?.items;
  if (!Array.isArray(lists)) throw new ImportFormatError('Это не файл Tasks.json из Google Takeout');
  return lists.flatMap((l) => (l.items ?? []).flatMap((t, i) => {
    const title = (t.title ?? '').trim();
    if (!title || t.deleted) return [];
    return [{
      key: t.id || `g-${l.title}-${i}`,
      parentKey: t.parent || null,
      title,
      notes: t.notes?.trim() || null,
      // Google хранит срок как полночь UTC: берём дату как есть, без перевода в пояс.
      date: datePart(t.due),
      time: null,
      priority: 3,
      recurrence: null,
      done: t.status === 'completed',
      list: l.title?.trim() || null,
    }];
  }));
}

/* ===== определение формата ===== */

export function parseImportFile(text: string): ImportResult {
  const warnings: string[] = [];
  const trimmed = text.replace(/^﻿/, '').trimStart();

  if (trimmed.startsWith('{')) {
    let json: unknown;
    try { json = JSON.parse(trimmed); } catch { throw new ImportFormatError('Файл похож на JSON, но повреждён'); }
    return { source: 'google-tasks', tasks: parseGoogleTasks(json), warnings };
  }

  const rows = parseCsvRows(trimmed);
  if (rows.length === 0) throw new ImportFormatError('Файл пуст');
  const head = rows[0].map((c) => c.trim().toUpperCase());
  if (head.includes('TYPE') && head.includes('CONTENT')) {
    return { source: 'todoist', tasks: parseTodoist(rows, warnings), warnings };
  }
  if (rows.slice(0, 12).some((r) => r.some((c) => c.trim() === 'List Name'))) {
    return { source: 'ticktick', tasks: parseTickTick(rows), warnings };
  }
  throw new ImportFormatError('Не удалось узнать формат. Поддерживаются CSV из Todoist, резервная копия TickTick и Tasks.json из Google Takeout.');
}

export const SOURCE_LABEL: Record<ImportSource, string> = {
  todoist: 'Todoist',
  ticktick: 'TickTick',
  'google-tasks': 'Google Tasks',
};

/** Создаёт задачи: сначала родителей, потом подзадачи, чтобы было к кому
 *  привязать. Возвращает, сколько создано. */
export function applyImport(
  items: ImportedTask[],
  opts: { includeCompleted: boolean; today: string },
  addTask: (t: {
    title: string; date: string; notes: string | null; priority: number; recurrence: Recurrence;
    parent_id: string | null; start_time: string | null; tags: string | null; status?: 'active' | 'done';
  }) => { id: string },
): number {
  const chosen = items.filter((t) => opts.includeCompleted || !t.done);
  const byKey = new Map(chosen.map((t) => [t.key, t]));
  const created = new Map<string, string>();
  let count = 0;

  const create = (t: ImportedTask, depth = 0): string | null => {
    if (created.has(t.key)) return created.get(t.key)!;
    if (depth > 20) return null; // защита от циклов в испорченном файле
    const parent = t.parentKey ? byKey.get(t.parentKey) : undefined;
    const parentId = parent ? create(parent, depth + 1) : null;
    const { id } = addTask({
      title: t.title,
      date: t.date ?? opts.today,
      notes: t.notes,
      priority: t.priority,
      recurrence: parentId ? null : t.recurrence, // у подзадач повторов не бывает
      parent_id: parentId,
      start_time: t.time,
      tags: t.list,
      ...(t.done ? { status: 'done' as const } : {}),
    });
    created.set(t.key, id);
    count++;
    return id;
  };
  chosen.forEach((t) => create(t));
  return count;
}
