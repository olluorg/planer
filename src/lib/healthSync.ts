import { useEffect } from 'react';
import { useStore } from './store';
import { isoDate } from './utils';
import { getEaten, eatenKcal, hasCompleteEatenCalories, isEatenStorageReadable, NUTRITION_EVENT } from './nutrition';
import { workoutSeconds, isWorkoutStorageReadable, ACTIVITY_EVENT } from './activity';
import { NUTRITION_OWNER_KEY, WORKOUT_OWNER_KEY, planOwnedHealthSync } from './nutritionSync';
import type { HealthMetric } from './types';

/**
 * Централизованная синхронизация виджетов.
 *
 * Локальные фичи (питание, зарядка, активность) хранят данные в своих стораx
 * (localStorage) и шлют события. Этот хук — единственное место, которое сводит
 * дневные итоги в `healthLogs` (SQLite) через `upsertHealthLog`. Оттуда их
 * забирают виджет «Здоровье» и авто-прогресс целей (goal.health_metric).
 *
 * Важное следствие для экосистемы: любой ВНЕШНИЙ источник (Apple Health,
 * Health Connect, Google Fit, умные часы), который просто пишет в `healthLogs`
 * (steps / weight / workout / calories), автоматически прорастает во все виджеты
 * и цели — отдельная проводка не нужна. См. docs/DATA_FLOW.md и docs/ECOSYSTEM.md.
 *
 * Монтируется один раз в App.
 */
export function useHealthSync() {
  const ready = useStore((s) => s.ready);

  useEffect(() => {
    // Пишем в healthLogs только когда SQLite инициализирована — иначе exec() упадёт
    if (!ready) return;
    let timer = 0;
    const run = () => {
      // Сравниваем с ФАКТИЧЕСКИМ значением в healthLogs (а не с ref) — иначе при
      // уменьшении значения (сняли отметку/сброс зарядки) кеш рассинхронизируется.
      const st = useStore.getState();
      const today = isoDate(new Date());
      // Автоматический источник меняет только собственные значения, не ручные или импортированные.
      const syncOwned = (metric: HealthMetric, key: string, count: number, total: number) => {
        const current = useStore.getState().healthLogs.find((l) => l.date === today && l.metric === metric);
        let owner: { date: string; value: number } | null = null;
        try { owner = JSON.parse(localStorage.getItem(key) || 'null'); } catch { /* old or invalid state */ }
        const previous = owner?.date === today && Number.isFinite(owner.value) ? owner.value : undefined;
        const decision = planOwnedHealthSync(current?.value, previous, count, total);
        if (decision.action === 'write') st.upsertHealthLog(today, metric, decision.value);
        if (decision.action === 'remove' && current) st.removeHealthLog(current.id);
        try {
          if (decision.action === 'write') localStorage.setItem(key, JSON.stringify({date: today, value: decision.value}));
          else if (decision.action === 'remove' || !decision.owned) localStorage.removeItem(key);
        } catch { /* leave health data intact if local storage is unavailable */ }
      };
      if (isEatenStorageReadable()) syncOwned('calories', NUTRITION_OWNER_KEY, hasCompleteEatenCalories(today) ? getEaten(today).length : 0, eatenKcal(today));
      if (isWorkoutStorageReadable()) {
        const wMin = Math.round(workoutSeconds(today) / 60);
        syncOwned('workout', WORKOUT_OWNER_KEY, wMin > 0 ? 1 : 0, wMin);
      }
    };
    const schedule = () => { window.clearTimeout(timer); timer = window.setTimeout(run, 300); };

    window.addEventListener(NUTRITION_EVENT, schedule);
    window.addEventListener(ACTIVITY_EVENT, schedule);
    window.addEventListener('thedad:workout-done', schedule);
    run(); // сверка при монтировании

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(NUTRITION_EVENT, schedule);
      window.removeEventListener(ACTIVITY_EVENT, schedule);
      window.removeEventListener('thedad:workout-done', schedule);
    };
  }, [ready]);
}
