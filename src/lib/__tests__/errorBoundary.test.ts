// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';

const mocks = vi.hoisted(() => ({ open: vi.fn(), saved: vi.fn() }));
vi.mock('../db', () => ({ DB_KEY: 'db', exportOpenDatabase: mocks.open }));
vi.mock('idb-keyval', () => ({ get: mocks.saved }));
vi.mock('../crashlog', () => ({ recordCrash: vi.fn(), buildCrashReport: () => '' }));
import { ErrorBoundary } from '@/components/ErrorBoundary';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.innerHTML = ''; });

it('reports when neither the open database nor the saved copy can be read', async () => {
  mocks.open.mockImplementation(() => { throw new Error('unavailable'); });
  mocks.saved.mockRejectedValue(new Error('unavailable'));
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  const Crash = () => { throw new Error('test'); };
  await act(async () => { root.render(createElement(ErrorBoundary, null, createElement(Crash))); });
  const button = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Скачать бэкап')!;
  await act(async () => { button.click(); });
  expect(el.querySelector('[role="alert"]')?.textContent).toContain('Не удалось прочитать базу');
  await act(async () => { root.unmount(); });
});

it('identifies a downloaded fallback as the last saved copy', async () => {
  mocks.open.mockReturnValue(null);
  mocks.saved.mockResolvedValue(new Uint8Array([1, 2, 3]));
  vi.stubGlobal('URL', { createObjectURL: vi.fn(() => 'blob:test'), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  const Crash = () => { throw new Error('test'); };
  await act(async () => { root.render(createElement(ErrorBoundary, null, createElement(Crash))); });
  const button = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Скачать бэкап')!;
  await act(async () => { button.click(); });
  expect(el.querySelector('[role="status"]')?.textContent).toContain('последняя сохранённая копия');
  await act(async () => { root.unmount(); });
});

it('downloads only the open database bytes and does not read an older copy', async () => {
  mocks.open.mockReturnValue(new Uint8Array([9, 1, 2, 3, 9]).subarray(1, 4));
  mocks.saved.mockReset();
  let downloaded: Blob | undefined;
  vi.stubGlobal('URL', { createObjectURL: vi.fn((blob: Blob) => { downloaded = blob; return 'blob:test'; }), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const el = document.createElement('div'); document.body.appendChild(el);
  const root = createRoot(el);
  const Crash = () => { throw new Error('test'); };
  await act(async () => { root.render(createElement(ErrorBoundary, null, createElement(Crash))); });
  const button = [...el.querySelectorAll('button')].find((b) => b.textContent === 'Скачать бэкап')!;
  await act(async () => { button.click(); });
  expect(Array.from(new Uint8Array(await downloaded!.arrayBuffer()))).toEqual([1, 2, 3]);
  expect(mocks.saved).not.toHaveBeenCalled();
  expect(el.querySelector('[role="status"]')).toBeNull();
  await act(async () => { root.unmount(); });
});

