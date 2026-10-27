import { it, expect } from 'vitest';
import { forecastSummary } from '../forecastSummary';
import type { Goal, ProgressRecord } from '../types';
import type { Forecast } from '../predict';

const goal: Goal = { id: 'g', parent_id: null, title: 'Goal', type: 'mid', metric: null,
  start_value: 0, target_value: 100, current_value: 20, unit: null, deadline: '2026-11-01',
  status: 'active', color: null, cover: null, health_metric: null, created_at: '2026-01-01', updated_at: '2026-10-26' };
const records: ProgressRecord[] = ['2026-10-24', '2026-10-25'].map((date, i) => ({ id: String(i), goal_id: 'g', date, value: i * 20, note: null }));
const forecast: Forecast = { series: [], forecast: [], etaDate: '2026-10-30', etaConfidence: 1, velocity: 20, method: 'linreg' };
const summary = (g = goal, r = records, f = forecast) => forecastSummary(g, r, f, '2026-10-26');

it('does not turn a perfect fit into success for an overdue goal', () => {
  expect(summary({ ...goal, deadline: '2026-10-20' })).toMatchObject({ label: 'Срок прошёл', tone: 'warning' });
});
it('hides extrapolations already in the past for an unfinished goal', () => {
  expect(summary(goal, records, { ...forecast, etaDate: '2026-10-22' })).toMatchObject({ eta: null, label: 'Обновите прогресс' });
});
it('needs distinct observation dates', () => {
  expect(summary(goal, [records[0], { ...records[1], date: records[0].date }])).toMatchObject({ eta: null, days: 1 });
});
it('compares the estimate with the deadline', () => {
  expect(summary().tone).toBe('success');
  expect(summary(goal, records, { ...forecast, etaDate: '2026-11-10' }).tone).toBe('warning');
});
it('recognizes achievement for decreasing metrics', () => {
  expect(summary({ ...goal, start_value: 90, target_value: 75, current_value: 74 }).label).toBe('Цель достигнута');
});
