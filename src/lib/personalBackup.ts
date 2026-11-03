import { get, set } from 'idb-keyval';
import { NUTRITION_OWNER_KEY, WORKOUT_OWNER_KEY } from './nutritionSync';

/** Deliberate allowlist: credentials and arbitrary localStorage entries never enter the file. */
export const PERSONAL_BACKUP_KEYS = [
  'user.name.v1', 'user.categories.v1', 'profile.role.v1', 'profile.photo.v1',
  'profile.weight.v1', 'profile.sex.v1', 'profile.age.v1', 'profile.height.v1',
  'nutrition.eaten.v1', 'nutrition.foods.v1', 'nutrition.kcal-goal.v1',
  'activity.manual.v1', 'workout.sessions.v1', 'workout.met-seconds.v1', 'workout.last.v1', 'workout.type.v1',
] as const;
const RECOVERY_KEY = 'thedad.personal-backup.recovery.v1';
const SCHEMA = 'thedad.personal-data/v1';
type Values = Record<string, string | null>;
type PersonalBackup = { schema: typeof SCHEMA; exportedAt: string; values: Values };
const JSON_ARRAYS = new Set(['user.categories.v1', 'nutrition.foods.v1']);
const JSON_OBJECTS = new Set(['nutrition.eaten.v1', 'activity.manual.v1', 'workout.sessions.v1', 'workout.met-seconds.v1']);
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const finiteNonnegative = (v: unknown) => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const macrosValid = (v: Record<string, unknown>) => ['protein','fat','carbs'].every(k => v[k] === undefined || finiteNonnegative(v[k]));

function snapshot(): Values {
  return Object.fromEntries(PERSONAL_BACKUP_KEYS.map(key => [key, localStorage.getItem(key)]));
}

export function exportPersonalData(): PersonalBackup {
  return {schema:SCHEMA, exportedAt:new Date().toISOString(), values:snapshot()};
}

export function parsePersonalData(raw: unknown): PersonalBackup {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Некорректный файл');
  const file = raw as Record<string, unknown>;
  if (file.schema !== SCHEMA || typeof file.exportedAt !== 'string' || !file.values || typeof file.values !== 'object' || Array.isArray(file.values)) throw new Error('Неверный формат копии');
  const values = { ...(file.values as Record<string, unknown>) };
  // Copies made before intensity tracking contain no metadata.
  if (!('workout.met-seconds.v1' in values)) values['workout.met-seconds.v1'] = null;
  if (Object.keys(values).some(key => !PERSONAL_BACKUP_KEYS.includes(key as typeof PERSONAL_BACKUP_KEYS[number]))) throw new Error('Копия содержит неподдерживаемые данные');
  if (PERSONAL_BACKUP_KEYS.some(key => !(key in values) || (values[key] !== null && typeof values[key] !== 'string'))) throw new Error('Копия неполная или повреждена');
  for (const key of PERSONAL_BACKUP_KEYS) {
    const value = values[key];
    if (typeof value !== 'string') continue;
    if (value.length > 6_000_000) throw new Error('Слишком большой элемент копии');
    if (JSON_ARRAYS.has(key) || JSON_OBJECTS.has(key)) {
      let parsed: unknown;
      try { parsed = JSON.parse(value); } catch { throw new Error(`Неверные данные: ${key}`); }
      if (JSON_ARRAYS.has(key) ? !Array.isArray(parsed) : !parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`Неверные данные: ${key}`);
      if (key === 'user.categories.v1' && !(parsed as unknown[]).every(v => typeof v === 'string')) throw new Error(`Неверные данные: ${key}`);
      if (key === 'nutrition.foods.v1' && !(parsed as unknown[]).every(v => object(v) && typeof v.id === 'string' && typeof v.title === 'string' && finiteNonnegative(v.kcal) && macrosValid(v))) throw new Error(`Неверные данные: ${key}`);
      if (key === 'nutrition.eaten.v1' && !Object.values(parsed as Record<string, unknown>).every(day => Array.isArray(day) && day.every(v => object(v) && typeof v.key === 'string' && typeof v.title === 'string' && typeof v.meal === 'string' && (v.kcal === undefined || finiteNonnegative(v.kcal)) && macrosValid(v)))) throw new Error(`Неверные данные: ${key}`);
      if (key === 'activity.manual.v1' && !Object.values(parsed as Record<string, unknown>).every(day => Array.isArray(day) && day.every(v => object(v) && typeof v.id === 'string' && typeof v.title === 'string' && finiteNonnegative(v.minutes) && finiteNonnegative(v.met) && finiteNonnegative(v.kcal)))) throw new Error(`Неверные данные: ${key}`);
      if (key === 'workout.sessions.v1' && !Object.values(parsed as Record<string, unknown>).every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0)) throw new Error(`Неверные данные: ${key}`);
      if (key === 'workout.met-seconds.v1' && !Object.values(parsed as Record<string, unknown>).every(v => object(v) && finiteNonnegative(v.seconds) && finiteNonnegative(v.metSeconds))) throw new Error(`Неверные данные: ${key}`);
    }
    if (key === 'profile.photo.v1' && value && !/^data:image\/(?:png|jpeg|webp);base64,/i.test(value)) throw new Error('Неверное изображение профиля');
    if (key === 'profile.sex.v1' && value !== 'male' && value !== 'female') throw new Error(`Неверные данные: ${key}`);
    const ranges: Record<string, [number, number]> = {'profile.age.v1':[5,120], 'profile.height.v1':[80,250], 'profile.weight.v1':[30,300], 'nutrition.kcal-goal.v1':[500,10000]};
    if (ranges[key] && (!Number.isFinite(Number(value)) || Number(value) < ranges[key][0] || Number(value) > ranges[key][1])) throw new Error(`Неверные данные: ${key}`);
  }
  return {schema:SCHEMA, exportedAt:file.exportedAt, values:values as Values};
}

function apply(values: Values) {
  for (const key of PERSONAL_BACKUP_KEYS) localStorage.removeItem(key);
  for (const key of PERSONAL_BACKUP_KEYS) if (values[key] !== null) localStorage.setItem(key, values[key]!);
}

/** Keep a separate recovery snapshot before touching localStorage. */
export async function restorePersonalData(file: PersonalBackup): Promise<void> {
  const next = parsePersonalData(file);
  // A damaged current value must not prevent importing a valid backup. Keep
  // its raw bytes in the local recovery snapshot so rollback stays lossless.
  const before = exportPersonalData();
  await set(RECOVERY_KEY, before);
  try {
    apply(next.values);
    // The SQLite health values were not restored with this file; do not claim ownership of them.
    localStorage.removeItem(NUTRITION_OWNER_KEY);
    localStorage.removeItem(WORKOUT_OWNER_KEY);
  }
  catch (error) {
    try { apply(before.values); }
    catch { throw new Error('Не удалось восстановить данные автоматически. Предыдущая копия сохранена для восстановления в настройках.'); }
    throw error;
  }
}

export async function hasPersonalRecovery(): Promise<boolean> {
  return Boolean(await get(RECOVERY_KEY));
}

export async function restorePersonalRecovery(): Promise<void> {
  const saved = await get<PersonalBackup>(RECOVERY_KEY);
  if (!saved) throw new Error('Предыдущая копия не найдена');
  // Recovery is a local snapshot, not an imported file. Its contents may be
  // malformed, but its shape and allowlisted keys must still be checked.
  if (object(saved) && object(saved.values) && !('workout.met-seconds.v1' in saved.values)) saved.values['workout.met-seconds.v1'] = null;
  if (!object(saved) || saved.schema !== SCHEMA || !object(saved.values) ||
      Object.keys(saved.values).some(key => !PERSONAL_BACKUP_KEYS.includes(key as typeof PERSONAL_BACKUP_KEYS[number])) ||
      PERSONAL_BACKUP_KEYS.some(key => !(key in saved.values) || (saved.values[key] !== null && typeof saved.values[key] !== 'string'))) {
    throw new Error('Предыдущая копия повреждена');
  }
  const before = exportPersonalData();
  await set(RECOVERY_KEY, before);
  try {
    apply(saved.values);
    localStorage.removeItem(NUTRITION_OWNER_KEY);
    localStorage.removeItem(WORKOUT_OWNER_KEY);
  } catch (error) {
    try { apply(before.values); }
    catch { throw new Error('Не удалось восстановить данные автоматически. Предыдущая копия сохранена для восстановления в настройках.'); }
    // A failed recovery must remain retryable after the current state is restored.
    await set(RECOVERY_KEY, saved);
    throw error;
  }
}
