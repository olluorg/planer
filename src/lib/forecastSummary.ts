import type { Goal, ProgressRecord } from './types';
import type { Forecast } from './predict';
import { todayISO } from './utils';

/** Present an estimate and its deadline status, never R² as a success probability. */
export function forecastSummary(
  goal: Goal, records: ProgressRecord[], forecast: Forecast, today = todayISO(),
) {
  const days = new Set(records.map((r) => r.date)).size;
  const direction = Math.sign(goal.target_value - goal.start_value) || 1;
  const achieved = direction * (goal.current_value - goal.target_value) >= 0;
  const stale = !!forecast.etaDate && forecast.etaDate < today && !achieved;
  const eta = days >= 2 && !stale ? forecast.etaDate : null;
  const overdue = !!goal.deadline && goal.deadline < today && !achieved;
  let label = 'Добавьте отметки в разные дни';
  let tone: 'neutral' | 'warning' | 'success' = 'neutral';
  if (achieved) { label = 'Цель достигнута'; tone = 'success'; }
  else if (overdue) { label = 'Срок прошёл'; tone = 'warning'; }
  else if (stale) { label = 'Обновите прогресс'; tone = 'warning'; }
  else if (eta && goal.deadline && eta > goal.deadline) { label = 'Позже срока при текущем темпе'; tone = 'warning'; }
  else if (eta && goal.deadline) { label = 'В пределах срока при текущем темпе'; tone = 'success'; }
  else if (eta) label = 'Оценка при текущем темпе';
  else if (days >= 2) label = 'Пока нет темпа к цели';
  return { eta, label, tone, days, evidence: `${days} дн. наблюдений · не гарантия результата` };
}
