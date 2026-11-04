// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { freshEnv } from './dbHarness';

vi.mock('sql.js', async (orig) => (await import('./dbHarness')).sqlJsWithLocalWasm(orig));
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: '' }));
vi.mock('../sound', () => ({ playSuccess: () => {}, playUnlock: () => {}, isSoundEnabled: () => false }));

let store: Awaited<ReturnType<Awaited<ReturnType<typeof freshEnv>>['store']>>['useStore'];
let marketplace: typeof import('../marketplace');
beforeEach(async () => {
  const env = await freshEnv();
  localStorage.clear();
  store = (await env.store()).useStore;
  marketplace = await import('../marketplace');
  await store.getState().init();
});

describe('program installation', () => {
  const pack = { schema: 'thedad.program/v1' as const, id: 'test-program', title: 'Тест', emoji: '🎯', goals: [{ title: 'Цель', type: 'long' as const, start_value: 0, target_value: 1 }], habits: [{ title: 'Привычка' }], tasks: [{ title: 'Задача' }] };
  it('rolls back earlier database inserts if a later action fails', () => {
    const state = store.getState();
    expect(() => marketplace.applyProgram(pack, { ...state, addTask: () => { throw new Error('Ошибка задачи'); } })).toThrow('Ошибка задачи');
    expect(store.getState().goals).toHaveLength(0);
    expect(store.getState().habits).toHaveLength(0);
    expect(marketplace.isInstalled(pack.id)).toBe(false);
  });
  it('installs once and refuses a duplicate before modifying data', () => {
    expect(marketplace.applyProgram(pack, store.getState())).toBe(3);
    expect(() => marketplace.applyProgram(pack, store.getState())).toThrow('уже установлена');
    expect(store.getState().goals).toHaveLength(1);
    expect(store.getState().habits).toHaveLength(1);
    expect(store.getState().tasks).toHaveLength(1);
  });
  it('restores program metadata and database when writing progress fails', () => {
    const original = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation(function (key, value) {
      if (key === 'program.progress.v1') throw new Error('Нет места');
      return original(key, value);
    });
    try {
      expect(() => marketplace.applyProgram(pack, store.getState())).toThrow('Нет места');
      expect(store.getState().goals).toHaveLength(0);
      expect(store.getState().tasks).toHaveLength(0);
      expect(localStorage.getItem('program.installed.v1')).toBeNull();
    } finally { spy.mockRestore(); }
  });
});

