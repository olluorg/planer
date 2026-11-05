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

