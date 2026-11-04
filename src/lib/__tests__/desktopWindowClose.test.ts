import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const { closeWindow } = createRequire(import.meta.url)('../../../electron/window-close.cjs');

describe('desktop close behavior', () => {
  it('quits instead of hiding when no tray is available', () => {
    const quit = vi.fn(), hide = vi.fn(), preventClose = vi.fn();
    expect(closeWindow({ quitting: false, hasTray: false, quit, hide, preventClose })).toBe('quit');
    expect(quit).toHaveBeenCalledOnce();
    expect(hide).not.toHaveBeenCalled();
    expect(preventClose).not.toHaveBeenCalled();
  });
  it('hides when a tray is available and does nothing while quitting', () => {
    const quit = vi.fn(), hide = vi.fn(), preventClose = vi.fn();
    expect(closeWindow({ quitting: false, hasTray: true, quit, hide, preventClose })).toBe('hidden');
    expect(hide).toHaveBeenCalledOnce();
    expect(preventClose).toHaveBeenCalledOnce();
    expect(closeWindow({ quitting: true, hasTray: true, quit, hide, preventClose })).toBe('quitting');
    expect(quit).not.toHaveBeenCalled();
    expect(hide).toHaveBeenCalledOnce();
  });
});
