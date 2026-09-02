import { describe, it, expect } from 'vitest';
import { forecast, type ForecastMethod } from '../forecast';
import { forecastGoal } from '../predict';
import type { Goal, ProgressRecord } from '../types';

const goal = (over: Partial<Goal> = {}): Goal => ({
  id: 'g1', parent_id: null, title: 'Цель', type: 'mid', metric: null,
  start_value: 0, target_value: 100, current_value: 0, unit: null, deadline: null,
  status: 'active', color: null, cover: null, health_metric: null,
  created_at: '2026-01-01', updated_at: '2026-01-01', ...over,
});

/** Ряд с фиксированным приростом в день, начиная с baseISO. */
const series = (baseISO: string, values: number[]): ProgressRecord[] =>
  values.map((value, i) => {
    const d = new Date(baseISO + 'T00:00:00');
    d.setDate(d.getDate() + i);
    return { id: `p${i}`, goal_id: 'g1', date: d.toISOString().slice(0, 10), value, note: null };
  });

describe('forecastGoal (линейная регрессия)', () => {
  it('на идеально линейном ряду восстанавливает скорость', () => {
    const f = forecastGoal(goal(), series('2026-01-01', [0, 10, 20, 30, 40]));
    expect(f.velocity).toBeCloseTo(10, 6);
    expect(f.method).toBe('linreg');
    expect(f.etaConfidence).toBeCloseTo(1, 6);
  });

  it('menее двух точек — плоский прогноз без ETA, а не деление на ноль', () => {
    const f = forecastGoal(goal({ current_value: 7 }), series('2026-01-01', [7]));
    expect(f.method).toBe('flat');
    expect(f.velocity).toBe(0);
    expect(f.etaDate).toBeNull();
    expect(f.forecast.every((p) => p.expected === 7)).toBe(true);
  });

  it('ряд без движения не выдумывает ETA', () => {
    const f = forecastGoal(goal(), series('2026-01-01', [5, 5, 5, 5]));
    expect(f.velocity).toBeCloseTo(0, 6);
    expect(f.etaDate).toBeNull();
  });

  it('движение в сторону от цели не даёт ETA', () => {
    // цель 100 сверху, а значения падают — дойти нельзя
    const f = forecastGoal(goal(), series('2026-01-01', [40, 30, 20, 10]));
    expect(f.velocity).toBeLessThan(0);
    expect(f.etaDate).toBeNull();
  });

  it('убывающая цель (похудение) корректно даёт ETA', () => {
    const f = forecastGoal(
      goal({ start_value: 100, target_value: 90, current_value: 96 }),
      series('2026-01-01', [100, 99, 98, 97, 96]),
    );
    expect(f.velocity).toBeLessThan(0);
    expect(f.etaDate).not.toBeNull();
  });

  it('доверительный интервал не инвертирован и горизонт соблюдён', () => {
    const f = forecastGoal(goal(), series('2026-01-01', [0, 9, 21, 29, 41]), 14);
    expect(f.forecast).toHaveLength(14);
    for (const p of f.forecast) {
      expect(p.low).toBeLessThanOrEqual(p.expected);
      expect(p.high).toBeGreaterThanOrEqual(p.expected);
      expect(Number.isFinite(p.expected)).toBe(true);
    }
  });

  it('multiplier масштабирует скорость', () => {
    const rows = series('2026-01-01', [0, 10, 20, 30]);
    const base = forecastGoal(goal(), rows, 30, 1);
    const doubled = forecastGoal(goal(), rows, 30, 2);
    expect(doubled.velocity).toBeCloseTo(base.velocity * 2, 6);
  });
});

describe('forecast (выбор метода)', () => {
  const rows = series('2026-01-01', [0, 10, 20, 30, 40, 50]);

  it('по умолчанию — linreg', () => {
    expect(forecast(goal(), rows, {}).method).toBe('linreg');
  });

  it.each(['linreg', 'ema', 'holt'] as const)('%s даёт конечные числа и заданный горизонт', (method: ForecastMethod) => {
    const f = forecast(goal(), rows, { method, horizon: 10 });
    expect(f.forecast).toHaveLength(10);
    expect(f.forecast.every((p) => Number.isFinite(p.expected) && Number.isFinite(p.low) && Number.isFinite(p.high))).toBe(true);
    expect(Number.isFinite(f.velocity)).toBe(true);
  });

  it.each(['ema', 'holt'] as const)('%s на коротком ряде не падает', (method: ForecastMethod) => {
    const f = forecast(goal(), series('2026-01-01', [3]), { method });
    expect(Number.isFinite(f.velocity)).toBe(true);
  });

  it('нерегулярный ряд с пропусками дат обрабатывается', () => {
    const sparse: ProgressRecord[] = [
      { id: 'a', goal_id: 'g1', date: '2026-01-01', value: 0, note: null },
      { id: 'b', goal_id: 'g1', date: '2026-01-10', value: 30, note: null },
      { id: 'c', goal_id: 'g1', date: '2026-02-01', value: 90, note: null },
    ];
    for (const method of ['linreg', 'ema', 'holt'] as const) {
      const f = forecast(goal(), sparse, { method });
      expect(f.forecast.every((p) => Number.isFinite(p.expected))).toBe(true);
    }
  });

  it('порядок записей не влияет на результат', () => {
    const shuffled = [...rows].reverse();
    expect(forecast(goal(), shuffled, {}).velocity).toBeCloseTo(forecast(goal(), rows, {}).velocity, 6);
  });
});
