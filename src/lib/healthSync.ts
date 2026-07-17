import { useEffect } from 'react';
import { useStore } from './store';
import { isoDate } from './utils';
import { getEaten, eatenKcal, NUTRITION_EVENT } from './nutrition';
import { workoutSeconds, ACTIVITY_EVENT } from './activity';

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
      const valueOf = (metric: string) => st.healthLogs.find((l) => l.date === today && l.metric === metric)?.value;

      // Калории: как только за день появилась хоть одна отметка «съел», метрику
      // ведём мы (включая обнуление). Пустой день не трогаем — вдруг залогировано вручную.
      const curCal = valueOf('calories');
      const owned = getEaten(today).length > 0 || curCal !== undefined;
      if (owned) {
        const cals = eatenKcal(today);
        if (curCal !== cals) st.upsertHealthLog(today, 'calories', cals);
      }

      // Зарядка: минуты за сегодня; пишем всегда, когда отличается от лога.
      const wMin = Math.round(workoutSeconds(today) / 60);
      if (wMin > 0 && valueOf('workout') !== wMin) st.upsertHealthLog(today, 'workout', wMin);
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
