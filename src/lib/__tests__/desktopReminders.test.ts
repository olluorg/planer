import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { createReminderScheduler } = require('../../../electron/reminder-scheduler.cjs');

afterEach(() => vi.useRealTimers());

describe('desktop reminders', () => {
  it('delivers every reminder at the same time and reschedules each for tomorrow', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 9, 59, 0));
    const notify = vi.fn();
    const scheduler = createReminderScheduler({ notify });
    scheduler.replace([{ enabled: true, time: '10:00', text: 'Первое' }, { enabled: true, time: '10:00', text: 'Второе' }]);
    vi.advanceTimersByTime(60_000);
    expect(notify.mock.calls.map(([item]) => item.text)).toEqual(['Первое', 'Второе']);
    vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    expect(notify).toHaveBeenCalledTimes(4);
    scheduler.clear();
  });

  it('replaces old timers and ignores invalid times', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 4, 9, 59, 0));
    const notify = vi.fn();
    const scheduler = createReminderScheduler({ notify });
    scheduler.replace([{ enabled: true, time: '10:00', text: 'Старое' }]);
    scheduler.replace([{ enabled: true, time: '24:90', text: 'Неверное' }, { enabled: true, time: '10:00', text: 'Новое' }]);
    vi.advanceTimersByTime(60_000);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(notify.mock.calls[0][0].text).toBe('Новое');
    scheduler.clear();
  });
});
