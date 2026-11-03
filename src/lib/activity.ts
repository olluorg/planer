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
// Approximate adult Compendium categories; real intensity varies by person.
// https://pacompendium.com/conditioning-exercise/
export const WORKOUT_TYPE_MET = { 'low-impact': 3.5, charge: 3.8, calisthenics: 5, yoga: 2.3 } as const;

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
const WORKOUT_DETAIL_KEY = 'workout.met-seconds.v1';
type WorkoutDetail = { seconds: number; metSeconds: number };

function loadMap<T>(key: string, strict = false): Record<string, T> {
  try {
    const raw = localStorage.getItem(key);
    const data: unknown = raw === null ? {} : JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid');
    const values = Object.values(data);
    const validNumber = (value: unknown) => typeof value === 'number' && Number.isFinite(value) && value >= 0;
    if (key === WORKOUT_KEY && !values.every(validNumber)) throw new Error('invalid');
    if (key === WORKOUT_DETAIL_KEY && !values.every(value => !!value && typeof value === 'object' && !Array.isArray(value) && validNumber((value as WorkoutDetail).seconds) && validNumber((value as WorkoutDetail).metSeconds))) throw new Error('invalid');
    if (key === 'activity.manual.v1' && !values.every(value => Array.isArray(value) && value.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string'))) throw new Error('invalid');
    return data as Record<string, T>;
  } catch {
    if (strict) throw new Error('Журнал активности повреждён или недоступен. Данные не изменены; сохраните копию перед восстановлением.');
    return {};
  }
}

export function isWorkoutStorageReadable(): boolean {
  try { loadMap(WORKOUT_KEY, true); loadMap(WORKOUT_DETAIL_KEY, true); return true; } catch { return false; }
}
export function isManualActivityStorageReadable(): boolean {
  try { loadMap('activity.manual.v1', true); return true; } catch { return false; }
}

function saveMap<T>(key: string, map: Record<string, T>, announce = true) {
  try { localStorage.setItem(key, JSON.stringify(map)); }
  catch { throw new Error('Не удалось сохранить активность. Проверьте свободное место в хранилище.'); }
  if (announce) window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
}

/** Добавить секунды зарядки к дню. Возвращает суммарные минуты за день. */
export function logWorkout(date: string, seconds: number, met = WORKOUT_MET): number {
  const map = loadMap<number>(WORKOUT_KEY, true);
  const previous = map[date] ?? 0;
  const duration = Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0;
  const details = loadMap<WorkoutDetail>(WORKOUT_DETAIL_KEY, true);
  const old = details[date];
  const priorMetSeconds = old && old.seconds === previous && Number.isFinite(old.metSeconds) ? old.metSeconds : previous * WORKOUT_MET;
  map[date] = previous + duration;
  details[date] = { seconds: map[date], metSeconds: priorMetSeconds + duration * (Number.isFinite(met) && met > 0 ? met : WORKOUT_MET) };
  const oldDetails = localStorage.getItem(WORKOUT_DETAIL_KEY);
  saveMap(WORKOUT_DETAIL_KEY, details, false);
  try { saveMap(WORKOUT_KEY, map, false); }
  catch (error) {
    try {
      if (oldDetails === null) localStorage.removeItem(WORKOUT_DETAIL_KEY);
      else localStorage.setItem(WORKOUT_DETAIL_KEY, oldDetails);
    } catch { /* mismatch remains detectable by the reader */ }
    throw error;
  }
  window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT));
  return Math.round(map[date] / 60);
}

export function workoutSeconds(date: string): number {
  return loadMap<number>(WORKOUT_KEY)[date] ?? 0;
}

/* ==================== Ручная активность ==================== */

export interface ManualActivity { id: string; title: string; minutes: number; met: number; kcal: number }

/** The stored estimate is gross; report the portion above rest in daily totals. */
export function manualActiveKcal(activity: ManualActivity): number {
  return activity.met > 1 ? Math.round(activity.kcal * (activity.met - 1) / activity.met) : 0;
}

const MANUAL_KEY = 'activity.manual.v1';

export function getManual(date: string): ManualActivity[] {
  return loadMap<ManualActivity[]>(MANUAL_KEY)[date] ?? [];
}

/** Добавить ручную тренировку. kcal считаются от MET и веса на момент записи. */
export function addManual(date: string, title: string, minutes: number, met: number, weight: number): ManualActivity[] {
  if (!title.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 1440 || !Number.isFinite(met) || met <= 0 || !Number.isFinite(weight) || weight <= 0) {
    throw new Error('Укажите вид активности и целое число минут от 1 до 1440.');
  }
  const map = loadMap<ManualActivity[]>(MANUAL_KEY, true);
  const mins = minutes;
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
  const map = loadMap<ManualActivity[]>(MANUAL_KEY, true);
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
  const seconds = workoutSeconds(date);
  const detail = loadMap<WorkoutDetail>(WORKOUT_DETAIL_KEY)[date];
  const metSeconds = detail && detail.seconds === seconds && Number.isFinite(detail.metSeconds) && detail.metSeconds >= 0 ? detail.metSeconds : seconds * WORKOUT_MET;
  // MET includes resting expenditure, already covered by the daily BMR.
  const workoutKcal = Math.round(metKcalPerMin(Math.max(0, metSeconds - seconds) / 60, weight));
  const manual = getManual(date);
  const manualKcal = manual.reduce((s, x) => s + manualActiveKcal(x), 0);
  return { steps, stepsKcal, workoutMin, workoutKcal, manual, manualKcal, total: stepsKcal + workoutKcal + manualKcal, weight };
}
