/**
 * Съеденное за день: отметки блюд из плана питания + ручные записи «что ещё ел».
 * Единый источник для виджетов «Питание», «Калории» и статистики здоровья:
 * итог дня виджеты записывают в healthLogs (metric 'calories') через upsertHealthLog —
 * оттуда его видит виджет «Здоровье» и авто-прогресс привязанных целей.
 */

export interface Macros { protein?: number; fat?: number; carbs?: number }
export function readCalories(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Unknown values stay unknown; explicit zero is valid nutrition data. */
export function readMacros(row: { protein?: unknown; fat?: unknown; carbs?: unknown }): Macros {
  const result: Macros = {};
  for (const key of ['protein', 'fat', 'carbs'] as const) {
    const value = row[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) result[key] = value;
  }
  return result;
}

export interface EatenItem extends Macros {
  key: string;      // стабильный ключ блюда ("Завтрак¦Овсянка…") или "custom:<id>"
  title: string;
  kcal?: number;
  meal: string;     // приём пищи («Завтрак»…), для ручных — «Другое»
  custom?: boolean; // добавлено вручную, не из плана
}

const KEY = 'nutrition.eaten.v1';
const GOAL_KEY = 'nutrition.kcal-goal.v1';
export const NUTRITION_EVENT = 'thedad:nutrition-changed';
export const DEFAULT_KCAL_GOAL = 2200;

type EatenStore = Record<string, EatenItem[]>;

function validateNutrition(title: string, kcal: number, macros: Macros = {}) {
  if (!title.trim() || !Number.isFinite(kcal) || kcal < 0) throw new Error('Укажите название и неотрицательное число калорий.');
  if ((['protein', 'fat', 'carbs'] as const).some(key => { const value = macros[key]; return value !== undefined && (typeof value !== 'number' || !Number.isFinite(value) || value < 0); })) {
    throw new Error('БЖУ должны быть неотрицательными числами.');
  }
}

function load(strict = false): EatenStore {
  try {
    const raw = localStorage.getItem(KEY);
    const data: unknown = raw === null ? {} : JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.values(data).every(day => Array.isArray(day) && day.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.key === 'string'))) throw new Error('invalid');
    return data as EatenStore;
  } catch {
    if (strict) throw new Error('Дневник питания повреждён или недоступен. Данные не изменены; сохраните копию перед восстановлением.');
    return {};
  }
}

export function isEatenStorageReadable(): boolean {
  try { load(true); return true; } catch { return false; }
}

function save(store: EatenStore) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); }
  catch { throw new Error('Не удалось сохранить дневник питания. Проверьте свободное место в хранилище.'); }
  window.dispatchEvent(new CustomEvent(NUTRITION_EVENT));
}

export function getEaten(date: string): EatenItem[] {
  return load()[date] ?? [];
}

export function isEaten(date: string, key: string): boolean {
  return getEaten(date).some((x) => x.key === key);
}

/** Отметить/снять блюдо из плана. Возвращает новый список дня. */
export function toggleEaten(date: string, item: EatenItem): EatenItem[] {
  const store = load(true);
  const day = store[date] ?? [];
  if (!day.some((x) => x.key === item.key)) {
    validateNutrition(item.title, item.kcal ?? 0, {protein:item.protein, fat:item.fat, carbs:item.carbs});
  }
  store[date] = day.some((x) => x.key === item.key)
    ? day.filter((x) => x.key !== item.key)
    : [...day, item];
  save(store);
  return store[date];
}

/** Ручная запись «что ещё съел» (не из плана), с опциональными БЖУ. */
export function addCustomEaten(date: string, title: string, kcal: number, meal = 'Другое', macros: Macros = {}): EatenItem[] {
  validateNutrition(title, kcal, macros);
  const store = load(true);
  const item: EatenItem = {
    key: `custom:${Math.random().toString(36).slice(2, 10)}`,
    title: title.trim().slice(0, 80),
    kcal: Math.max(0, Math.round(kcal)),
    meal,
    custom: true,
    ...cleanMacros(macros),
  };
  store[date] = [...(store[date] ?? []), item];
  save(store);
  return store[date];
}

export function removeEaten(date: string, key: string): EatenItem[] {
  const store = load(true);
  store[date] = (store[date] ?? []).filter((x) => x.key !== key);
  save(store);
  return store[date];
}

export function eatenKcal(date: string): number {
  return getEaten(date).reduce((s, x) => s + (x.kcal || 0), 0);
}

export function hasCompleteEatenCalories(date: string): boolean {
  const entries = getEaten(date);
  return entries.length > 0 && entries.every(item => readCalories(item.kcal) !== undefined);
}

/** Сумма БЖУ съеденного за день (только по тем позициям, где макросы указаны). */
export function eatenMacros(date: string): Required<Macros> {
  return getEaten(date).reduce(
    (a, x) => ({ protein: a.protein + (x.protein || 0), fat: a.fat + (x.fat || 0), carbs: a.carbs + (x.carbs || 0) }),
    { protein: 0, fat: 0, carbs: 0 },
  );
}

function cleanMacros(m: Macros): Macros {
  const out: Macros = {};
  for (const key of ['protein', 'fat', 'carbs'] as const) {
    const value = m[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = Math.round(value * 10) / 10;
  }
  return out;
}

/* ==================== Свои продукты (личная библиотека) ====================
 * Хранятся отдельно от плана-плагина: фото (сжатый dataURL) и БЖУ могут быть
 * большими и личными — их не кладём в общий/экспортируемый плагин. */

export interface CustomFood extends Macros {
  id: string;
  title: string;
  kcal: number;
  image?: string;   // сжатый dataURL или пусто
}

const FOODS_KEY = 'nutrition.foods.v1';

function loadFoods(strict = false): CustomFood[] {
  try {
    const raw = localStorage.getItem(FOODS_KEY);
    const data: unknown = raw === null ? [] : JSON.parse(raw);
    if (!Array.isArray(data) || !data.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof item.id === 'string' && typeof item.title === 'string')) throw new Error('invalid');
    return data as CustomFood[];
  } catch {
    if (strict) throw new Error('Библиотека продуктов повреждена или недоступна. Данные не изменены; сохраните копию перед восстановлением.');
    return [];
  }
}
export function getFoods(): CustomFood[] { return loadFoods(); }
export function isFoodStorageReadable(): boolean { try { loadFoods(true); return true; } catch { return false; } }

function saveFoods(list: CustomFood[]) {
  try { localStorage.setItem(FOODS_KEY, JSON.stringify(list)); }
  catch { throw new Error('Не удалось сохранить библиотеку продуктов. Проверьте свободное место в хранилище.'); }
  window.dispatchEvent(new CustomEvent(NUTRITION_EVENT));
}

export function addFood(food: Omit<CustomFood, 'id'>): CustomFood[] {
  validateNutrition(food.title, food.kcal, {protein:food.protein, fat:food.fat, carbs:food.carbs});
  const item: CustomFood = {
    id: Math.random().toString(36).slice(2, 10),
    title: food.title.trim().slice(0, 80),
    kcal: Math.max(0, Math.round(food.kcal)),
    ...(food.image ? { image: food.image } : {}),
    ...cleanMacros(food),
  };
  const list = [item, ...loadFoods(true)];
  saveFoods(list);
  return list;
}

export function removeFood(id: string): CustomFood[] {
  const list = loadFoods(true).filter((f) => f.id !== id);
  saveFoods(list);
  return list;
}

/** Съесть свой продукт: добавляет запись в съеденное за день (с БЖУ). */
export function eatFood(date: string, food: CustomFood, meal = 'Мои продукты'): EatenItem[] {
  return addCustomEaten(date, food.title, food.kcal, meal, food);
}

/** Экспорт библиотеки своих продуктов в .json (шаринг/перенос между устройствами). */
export function exportFoods() {
  const payload = { schema: 'thedad.foods/v1', foods: loadFoods(true) };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thedad-foods-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Импорт продуктов: валидация + слияние по названию (дубли не плодим). Возвращает число добавленных. */
export function importFoods(raw: unknown): number {
  const data = raw as { schema?: string; foods?: unknown };
  const arr = Array.isArray(data?.foods) ? data.foods : Array.isArray(raw) ? (raw as unknown[]) : null;
  if (!arr) throw new Error('Неверный формат файла продуктов');
  const existing = loadFoods(true);
  const seen = new Set(existing.map((f) => f.title.toLowerCase()));
  let added = 0;
  const clean: CustomFood[] = [];
  for (const item of arr) {
    const f = item as Partial<CustomFood>;
    if (!f || typeof f.title !== 'string' || !f.title.trim()) continue;
    if (typeof f.kcal !== 'number' || !Number.isFinite(f.kcal) || f.kcal < 0) continue;
    if (seen.has(f.title.trim().toLowerCase())) continue;
    // картинку принимаем только как data-URL или локальный путь (без внешней сети)
    const img = typeof f.image === 'string' && (f.image.startsWith('data:image/') || (f.image.startsWith('/') && !f.image.startsWith('//'))) ? f.image : undefined;
    clean.push({
      id: Math.random().toString(36).slice(2, 10),
      title: f.title.trim().slice(0, 80),
      kcal: Math.round(f.kcal),
      ...(img ? { image: img } : {}),
      ...cleanMacros(f),
    });
    seen.add(f.title.trim().toLowerCase());
    added++;
  }
  if (added > 0) saveFoods([...clean, ...existing]);
  return added;
}

/** Дневная цель калорий (правится в развороте виджета «Калории»). */
export function getKcalGoal(): number {
  const v = Number(localStorage.getItem(GOAL_KEY));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_KCAL_GOAL;
}

export function setKcalGoal(v: number) {
  if (!Number.isFinite(v)) throw new Error('Укажите числовую цель по калориям.');
  try { localStorage.setItem(GOAL_KEY, String(Math.max(500, Math.min(10000, Math.round(v))))); }
  catch { throw new Error('Не удалось сохранить цель по калориям. Проверьте свободное место в хранилище.'); }
  window.dispatchEvent(new CustomEvent(NUTRITION_EVENT));
}
