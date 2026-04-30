import type { Goal, ProgressRecord } from './types';
import { forecastGoal as linregForecast, type Forecast } from './predict';

export type ForecastMethod = 'linreg' | 'ema' | 'holt';

function dayDiff(a: string, b: string) { return Math.round((Date.parse(b) - Date.parse(a)) / 86400000); }
function addDays(iso: string, d: number) { const x = new Date(iso); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); }

// Resample irregular series to daily by linear interpolation, fill gaps.
function resampleDaily(records: ProgressRecord[]): { dates: string[]; values: number[] } {
  if (records.length === 0) return { dates: [], values: [] };
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const start = sorted[0].date;
  const end = sorted[sorted.length - 1].date;
  const n = dayDiff(start, end) + 1;
  const dates: string[] = [];
  const values: number[] = [];
  let j = 0;
  for (let i = 0; i < n; i++) {
    const d = addDays(start, i);
    while (j + 1 < sorted.length && sorted[j + 1].date <= d) j++;
    const a = sorted[j];
    const b = sorted[Math.min(j + 1, sorted.length - 1)];
    if (a.date === b.date) values.push(a.value);
    else {
      const t = (Date.parse(d) - Date.parse(a.date)) / (Date.parse(b.date) - Date.parse(a.date));
      values.push(a.value + t * (b.value - a.value));
    }
    dates.push(d);
  }
  return { dates, values };
}

function emaForecast(goal: Goal, records: ProgressRecord[], horizon: number, multiplier: number): Forecast {
  const series = records.map((r) => ({ date: r.date, value: r.value }));
  if (records.length < 2) return { ...linregForecast(goal, records, horizon, multiplier), method: 'ema' };
  const { values } = resampleDaily(records);
  const alpha = 0.3;
  const smoothed: number[] = [];
  values.forEach((v, i) => smoothed.push(i === 0 ? v : alpha * v + (1 - alpha) * smoothed[i - 1]));
  const lastSmoothed = smoothed[smoothed.length - 1];
  // velocity from last 5 daily values
  const tail = values.slice(-5);
  const vel = tail.length > 1 ? (tail[tail.length - 1] - tail[0]) / (tail.length - 1) * multiplier : 0;
  const today = new Date().toISOString().slice(0, 10);
  const std = stddev(values.slice(-Math.min(values.length, 14)));
  const ci = 1.96 * std;
  const forecast = Array.from({ length: horizon }, (_, i) => {
    const expected = lastSmoothed + vel * (i + 1);
    return { date: addDays(today, i + 1), expected, low: expected - ci * Math.sqrt(i + 1), high: expected + ci * Math.sqrt(i + 1) };
  });
  let etaDate: string | null = null;
  if (vel !== 0 && Math.sign(vel) === Math.sign(goal.target_value - lastSmoothed)) {
    const days = (goal.target_value - lastSmoothed) / vel;
    if (isFinite(days) && days > 0 && days < 3650) etaDate = addDays(today, Math.round(days));
  }
  return { series, forecast, etaDate, etaConfidence: 0.7, velocity: vel, method: 'ema' };
}

// Holt's linear (double exponential smoothing).
function holtForecast(goal: Goal, records: ProgressRecord[], horizon: number, multiplier: number): Forecast {
  const series = records.map((r) => ({ date: r.date, value: r.value }));
  if (records.length < 3) return { ...linregForecast(goal, records, horizon, multiplier), method: 'holt' };
  const { values } = resampleDaily(records);
  const alpha = 0.4, beta = 0.2;
  let level = values[0];
  let trend = values[1] - values[0];
  for (let i = 1; i < values.length; i++) {
    const prevLevel = level;
    level = alpha * values[i] + (1 - alpha) * (level + trend);
    trend = beta * (level - prevLevel) + (1 - beta) * trend;
  }
  trend *= multiplier;
  const today = new Date().toISOString().slice(0, 10);
  const std = stddev(values.slice(-Math.min(values.length, 14)));
  const ci = 1.96 * std;
  const forecast = Array.from({ length: horizon }, (_, i) => {
    const expected = level + trend * (i + 1);
    return { date: addDays(today, i + 1), expected, low: expected - ci * Math.sqrt(i + 1), high: expected + ci * Math.sqrt(i + 1) };
  });
  let etaDate: string | null = null;
  if (trend !== 0 && Math.sign(trend) === Math.sign(goal.target_value - level)) {
    const days = (goal.target_value - level) / trend;
    if (isFinite(days) && days > 0 && days < 3650) etaDate = addDays(today, Math.round(days));
  }
  return { series, forecast, etaDate, etaConfidence: 0.75, velocity: trend, method: 'holt' };
}

function stddev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = arr.reduce((s, x) => s + x, 0) / arr.length;
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

export function forecast(goal: Goal, records: ProgressRecord[], opts: {
  horizon?: number;
  multiplier?: number;
  method?: ForecastMethod;
}): Forecast {
  const horizon = opts.horizon ?? 30;
  const multiplier = opts.multiplier ?? 1;
  const method = opts.method ?? 'linreg';
  if (method === 'ema') return emaForecast(goal, records, horizon, multiplier);
  if (method === 'holt') return holtForecast(goal, records, horizon, multiplier);
  return linregForecast(goal, records, horizon, multiplier);
}
