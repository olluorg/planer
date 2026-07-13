/** Профиль пользователя для расчётов калорий. Вес берём из последнего лога «Здоровья»
 *  (metric 'weight'), иначе — из ручной настройки, иначе дефолт. */
import type { HealthLog } from './types';

export const DEFAULT_WEIGHT = 70;
const WEIGHT_KEY = 'profile.weight.v1';
const SEX_KEY = 'profile.sex.v1';
const AGE_KEY = 'profile.age.v1';
const HEIGHT_KEY = 'profile.height.v1';
export const PROFILE_EVENT = 'thedad:profile-changed';

export type Sex = 'male' | 'female';

export function getProfileWeight(): number {
  const v = Number(localStorage.getItem(WEIGHT_KEY));
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_WEIGHT;
}

export function setProfileWeight(v: number) {
  try { localStorage.setItem(WEIGHT_KEY, String(Math.max(30, Math.min(300, Math.round(v))))); } catch {}
  window.dispatchEvent(new CustomEvent(PROFILE_EVENT));
}

export function getSex(): Sex | null { return (localStorage.getItem(SEX_KEY) as Sex) || null; }
export function setSex(v: Sex) { try { localStorage.setItem(SEX_KEY, v); } catch {} window.dispatchEvent(new CustomEvent(PROFILE_EVENT)); }

export function getAge(): number | null { const v = Number(localStorage.getItem(AGE_KEY)); return v > 0 ? v : null; }
export function setAge(v: number) { try { localStorage.setItem(AGE_KEY, String(Math.max(5, Math.min(120, Math.round(v))))); } catch {} window.dispatchEvent(new CustomEvent(PROFILE_EVENT)); }

export function getHeight(): number | null { const v = Number(localStorage.getItem(HEIGHT_KEY)); return v > 0 ? v : null; }
export function setHeight(v: number) { try { localStorage.setItem(HEIGHT_KEY, String(Math.max(80, Math.min(250, Math.round(v))))); } catch {} window.dispatchEvent(new CustomEvent(PROFILE_EVENT)); }

/** Актуальный вес для формул: свежайший лог веса > ручная настройка > дефолт. */
export function resolveWeight(healthLogs: HealthLog[]): number {
  const weights = healthLogs
    .filter((l) => l.metric === 'weight' && l.value > 0)
    .sort((a, b) => b.date.localeCompare(a.date));
  return weights[0]?.value ?? getProfileWeight();
}

/** Базовый метаболизм (ккал/сутки в покое) по Миффлину-Сан-Жеору.
 *  Нужны пол, возраст и рост; иначе 0 (тогда учитываем только активность). */
export function computeBMR(weight: number): number {
  const sex = getSex(), age = getAge(), height = getHeight();
  if (!sex || !age || !height) return 0;
  const base = 10 * weight + 6.25 * height - 5 * age;
  return Math.round(base + (sex === 'male' ? 5 : -161));
}

export function hasBmrProfile(): boolean {
  return !!getSex() && !!getAge() && !!getHeight();
}
