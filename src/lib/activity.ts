/**
 * Активность за день: шаги (из healthLogs), зарядка (WorkoutMode) и ручные записи.
 * Всё переводится в сожжённые калории для виджета «Активность» и баланса дня.
 * Минуты зарядки дополнительно пишутся в healthLogs (metric 'workout') —
 * их видит «Здоровье» и авто-прогресс целей.
 */

export const ACTIVITY_EVENT = 'thedad:activity-changed';

/* Расчёт по весу тела. MET (metabolic equivalent) — стандартные коэффициенты нагрузки.
 * ккал/мин = MET × 3.5 × вес(кг) / 200. Шаги масштабируются линейно от веса. */
export const WORKOUT_MET = 8;               // интенсивная зарядка (calisthenics)

/** ккал за один шаг при данном весе (~0.0005 × вес: 0.035 при 70 кг). */
export function stepKcal(weight: number): number {
  return weight * 0.0005;
}

/** ккал в минуту нагрузки с данным MET при данном весе. */
export function metKcalPerMin(met: number, weight: number): number {
  return (met * 3.5 * weight) / 200;
}

/** Пресеты ручной активности: MET-нагрузка (ккал считаются от веса пользователя). */
export const MANUAL_PRESETS = [
  { id: 'run', label: 'Бег', met: 9.8 },
  { id: 'walk', label: 'Ходьба', met: 3.5 },
  { id: 'bike', label: 'Велосипед', met: 7.5 },
  { id: 'swim', label: 'Плавание', met: 8 },
  { id: 'gym', label: 'Силовая', met: 5 },
  { id: 'yoga', label: 'Йога/растяжка', met: 3 },
  { id: 'other', label: 'Другое', met: 4 },
] as const;

/* ==================== Зарядка (секунды за день) ==================== */

const WORKOUT_KEY = 'workout.sessions.v1';

function loadMap<T>(key: string): Record<string, T> {
  try { return JSON.parse(localStorage.getItem(key) || '{}'); } catch { return {}; }
}

function saveMap<T>(key: string, map: Record<string, T>) {
  const dates = Object.keys(map).sort();
  for (const d of dates.slice(0, Math.max(0, dates.length - 90))) delete map[d];
  try { localStorage.setItem(key, JSON.stringify(map)); } catch {}
  window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
}

/** Добавить секунды зарядки к дню. Возвращает суммарные минуты за день. */
export function logWorkout(date: string, seconds: number): number {
  const map = loadMap<number>(WORKOUT_KEY);
  map[date] = (map[date] ?? 0) + Math.max(0, Math.round(seconds));
  saveMap(WORKOUT_KEY, map);
  return Math.round(map[date] / 60);
}

export function workoutSeconds(date: string): number {
  return loadMap<number>(WORKOUT_KEY)[date] ?? 0;
}

/* ==================== Ручная активность ==================== */

export interface ManualActivity { id: string; title: string; minutes: number; met: number; kcal: number }

const MANUAL_KEY = 'activity.manual.v1';

export function getManual(date: string): ManualActivity[] {
  return loadMap<ManualActivity[]>(MANUAL_KEY)[date] ?? [];
}

/** Добавить ручную тренировку. kcal считаются от MET и веса на момент записи. */
export function addManual(date: string, title: string, minutes: number, met: number, weight: number): ManualActivity[] {
  const map = loadMap<ManualActivity[]>(MANUAL_KEY);
  const mins = Math.max(1, Math.round(minutes));
  const item: ManualActivity = {
    id: Math.random().toString(36).slice(2, 10),
    title: title.trim().slice(0, 60),
    minutes: mins,
    met,
    kcal: Math.round(metKcalPerMin(met, weight) * mins),
  };
  map[date] = [...(map[date] ?? []), item];
  saveMap(MANUAL_KEY, map);
  return map[date];
}

export function removeManual(date: string, id: string): ManualActivity[] {
  const map = loadMap<ManualActivity[]>(MANUAL_KEY);
  map[date] = (map[date] ?? []).filter((x) => x.id !== id);
  saveMap(MANUAL_KEY, map);
  return map[date];
}

/* ==================== Итог дня ==================== */

export interface BurnedBreakdown {
  steps: number;        // шагов за день (передаётся из healthLogs)
  stepsKcal: number;
  workoutMin: number;
  workoutKcal: number;
  manual: ManualActivity[];
  manualKcal: number;
  total: number;
  weight: number;
}

/** Сожжённые калории дня по весу тела. Шаги приходят снаружи (healthLogs из стора). */
export function burnedKcal(date: string, steps: number, weight: number): BurnedBreakdown {
  const stepsKcal = Math.round(steps * stepKcal(weight));
  const workoutMin = Math.round(workoutSeconds(date) / 60);
  const workoutKcal = Math.round(workoutMin * metKcalPerMin(WORKOUT_MET, weight));
  const manual = getManual(date);
  const manualKcal = manual.reduce((s, x) => s + x.kcal, 0);
  return { steps, stepsKcal, workoutMin, workoutKcal, manual, manualKcal, total: stepsKcal + workoutKcal + manualKcal, weight };
}
