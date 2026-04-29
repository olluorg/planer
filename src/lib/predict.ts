import type { Goal, ProgressRecord } from './types';

export interface Forecast {
  series: { date: string; value: number }[];
  forecast: { date: string; expected: number; low: number; high: number }[];
  etaDate: string | null;
  etaConfidence: number;
  velocity: number;
  method: 'linreg' | 'ema' | 'flat';
}

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function forecastGoal(
  goal: Goal,
  records: ProgressRecord[],
  horizonDays = 30,
  multiplier = 1,
): Forecast {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const series = sorted.map((r) => ({ date: r.date, value: r.value }));
  const target = goal.target_value;
  const start = goal.start_value;
  const direction = target >= start ? 1 : -1;
  const today = new Date().toISOString().slice(0, 10);

  if (series.length < 2) {
    const flat: Forecast = {
      series,
      forecast: Array.from({ length: horizonDays }, (_, i) => {
        const date = addDays(today, i + 1);
        return { date, expected: goal.current_value, low: goal.current_value, high: goal.current_value };
      }),
      etaDate: null,
      etaConfidence: 0,
      velocity: 0,
      method: 'flat',
    };
    return flat;
  }

  const xs = series.map((s) => dayDiff(series[0].date, s.date));
  const ys = series.map((s) => s.value);
  const n = xs.length;
  const sx = xs.reduce((a, b) => a + b, 0);
  const sy = ys.reduce((a, b) => a + b, 0);
  const sxx = xs.reduce((a, b) => a + b * b, 0);
  const sxy = xs.reduce((a, _, i) => a + xs[i] * ys[i], 0);
  const denom = n * sxx - sx * sx || 1;
  const slope = ((n * sxy - sx * sy) / denom) * multiplier;
  const intercept = (sy - slope * sx) / n;

  const meanY = sy / n;
  const ssRes = ys.reduce((a, y, i) => a + (y - (intercept + slope * xs[i])) ** 2, 0);
  const ssTot = ys.reduce((a, y) => a + (y - meanY) ** 2, 0) || 1;
  const r2 = Math.max(0, 1 - ssRes / ssTot);
  const stdErr = Math.sqrt(ssRes / Math.max(1, n - 2));

  const baseDate = series[0].date;
  const forecast = Array.from({ length: horizonDays }, (_, i) => {
    const x = dayDiff(baseDate, today) + i + 1;
    const expected = intercept + slope * x;
    const ci = 1.96 * stdErr * Math.sqrt(1 + 1 / n + ((x - sx / n) ** 2) / (sxx - (sx * sx) / n || 1));
    return {
      date: addDays(today, i + 1),
      expected,
      low: expected - ci,
      high: expected + ci,
    };
  });

  let etaDate: string | null = null;
  if (slope !== 0 && Math.sign(slope) === Math.sign(direction)) {
    const xEta = (target - intercept) / slope;
    if (isFinite(xEta) && xEta > 0) etaDate = addDays(baseDate, Math.round(xEta));
  }

  return {
    series,
    forecast,
    etaDate,
    etaConfidence: r2,
    velocity: slope,
    method: 'linreg',
  };
}

export function ema(values: number[], alpha = 0.3): number[] {
  const out: number[] = [];
  values.forEach((v, i) => {
    out.push(i === 0 ? v : alpha * v + (1 - alpha) * out[i - 1]);
  });
  return out;
}
