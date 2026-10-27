import { afterEach, expect, it, vi } from 'vitest';
import { readMacros, toggleEaten, eatenMacros, eatenKcal } from '../nutrition';

afterEach(() => vi.unstubAllGlobals());

it('keeps zero distinct from missing or invalid macros', () => {
  expect(readMacros({ protein: 0, fat: -2, carbs: Infinity })).toEqual({ protein: 0 });
  expect(readMacros({ protein: null, fat: '', carbs: '20' })).toEqual({});
});

it('persists meal macros in daily totals and removes them when unchecked', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  const item = { key: 'Обед¦Тест', title: 'Тест', meal: 'Обед', kcal: 400, ...readMacros({ protein: 30, fat: 12, carbs: 40 }) };
  toggleEaten('2026-10-26', item);
  expect(eatenMacros('2026-10-26')).toEqual({ protein: 30, fat: 12, carbs: 40 });
  expect(eatenKcal('2026-10-26')).toBe(400);
  toggleEaten('2026-10-26', item);
  expect(eatenMacros('2026-10-26')).toEqual({ protein: 0, fat: 0, carbs: 0 });
});
