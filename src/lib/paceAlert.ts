/** «Не успеваете»: прогноз, который сам приходит, а не ждёт, пока его откроют.
 *
 *  Когда при нынешнем темпе цель к сроку не достигается, пользователь получает
 *  одну карточку с тремя честными выходами — все три в цифрах:
 *    1) какой темп нужен, чтобы успеть;
 *    2) когда цель будет достигнута, если сдвинуть срок;
 *    3) сколько реально успеть к сроку — если уменьшить цель.
 *  Приложение не выбирает за человека, но и не даёт узнать о проблеме в
 *  последнюю неделю.
 */
import type { Goal, ProgressRecord } from './types';
import { forecastGoal } from './predict';
import { todayISO } from './utils';

export interface PaceVerdict {
  goalId: string;
  title: string;
  unit: string;
  target: number;
  current: number;
  deadline: string;
  /** Сколько дней осталось до срока. */
  daysLeft: number;
  /** Текущая скорость, единиц в день (со знаком). */
  velocity: number;
  /** Нужная скорость, чтобы успеть, единиц в день (со знаком). */
  required: number;
  /** Значение к сроку при текущем темпе. */
  reachable: number;
  /** Дата достижения при текущем темпе; null — при нынешнем темпе не достичь вовсе. */
  eta: string | null;
}

const DAY = 86_400_000;
const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + 'T00:00:00') - Date.parse(a + 'T00:00:00')) / DAY);

/** Допуск: отставание меньше 2% пути — шум измерений, а не повод тревожить. */
const TOLERANCE = 0.02;

/** Оценка одной цели. null — либо всё в порядке, либо судить не по чему. */
export function assessPace(goal: Goal, records: ProgressRecord[], today = todayISO()): PaceVerdict | null {
  if (goal.status !== 'active' || !goal.deadline) return null;
  const daysLeft = daysBetween(today, goal.deadline);
  if (daysLeft <= 0) return null; // срок прошёл — об этом говорит сама карточка цели

  // Судить о темпе можно только по двум разным дням, как и строить прогноз.
  const own = records.filter((r) => r.goal_id === goal.id);
  if (new Set(own.map((r) => r.date)).size < 2) return null;

  const direction = goal.target_value >= goal.start_value ? 1 : -1;
  const latest = [...own].sort((a, b) => a.date.localeCompare(b.date)).at(-1)!;
  const current = latest.value;
  const gap = goal.target_value - current;
  if (gap * direction <= 0) return null; // уже достигнута

  const f = forecastGoal(goal, own, 1);
  const velocity = f.velocity;
  const reachable = current + velocity * daysLeft;
  const path = Math.abs(goal.target_value - goal.start_value) || 1;
  const shortfall = (goal.target_value - reachable) * direction;
  if (shortfall <= path * TOLERANCE) return null; // успевает

  const movingRight = velocity * direction > 0;
  const eta = movingRight ? addDays(today, Math.ceil(gap / velocity)) : null;

  return {
    goalId: goal.id,
    title: goal.title,
    unit: goal.unit ?? '',
    target: goal.target_value,
    current,
    deadline: goal.deadline,
    daysLeft,
    velocity,
    required: gap / daysLeft,
    reachable,
    eta,
  };
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const x = new Date(y, m - 1, d + n);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

/* ===== Текст карточки ===== */

const num = (v: number) => {
  const a = Math.abs(v);
  const digits = a >= 100 ? 0 : a >= 10 ? 1 : 2;
  return Number(v.toFixed(digits)).toLocaleString('ru-RU');
};
const date = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
};

export function paceMessage(v: PaceVerdict): { title: string; body: string } {
  const u = v.unit ? ` ${v.unit}` : '';
  const perDay = (x: number) => `${num(Math.abs(x))}${u} в день`;
  const lines = [
    `К ${date(v.deadline)} при нынешнем темпе будет ${num(v.reachable)}${u} из ${num(v.target)}.`,
    `• Успеть в срок: ${perDay(v.required)}${v.velocity * Math.sign(v.required) > 0 ? ` вместо ${perDay(v.velocity)}` : ''}.`,
    v.eta ? `• Сдвинуть срок на ${date(v.eta)}.` : '• Сдвинуть срок не поможет: сейчас прогресса к цели нет.',
    `• Уменьшить цель до ${num(v.reachable)}${u}.`,
  ];
  return { title: `«${v.title}» не успевает к сроку`, body: lines.join('\n') };
}

/* ===== Когда показывать ===== */

const SEEN_KEY = 'thedad.pace.seen.v1';
const REPEAT_MS = 7 * DAY;

function seen(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}'); } catch { return {}; }
}

/** Цели, по которым пора предупредить: отстают и не предупреждали неделю.
 *  Отмечает их как показанные — вызывающий обязан показать. */
export function duePaceAlerts(goals: Goal[], progress: ProgressRecord[], now = Date.now(), today = todayISO()): PaceVerdict[] {
  const s = seen();
  const due: PaceVerdict[] = [];
  for (const g of goals) {
    const v = assessPace(g, progress, today);
    if (!v) continue;
    if (now - (s[g.id] ?? 0) < REPEAT_MS) continue;
    s[g.id] = now;
    due.push(v);
  }
  if (due.length) {
    try { localStorage.setItem(SEEN_KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
  }
  return due;
}
