import { afterEach, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

it('writes reminder changes in order before requesting rescheduling', async () => {
  vi.resetModules();
  let release!: () => void;
  const firstWrite = new Promise<void>(resolve => { release = resolve; });
  const set = vi.fn().mockImplementationOnce(() => firstWrite).mockResolvedValue(undefined);
  const sendMessage = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal('chrome', { runtime: { id: 'test', sendMessage }, storage: { local: { set } } });
  const { syncRemindersToExtension } = await import('../extension');
  const first = [{ id: '1', text: 'Первое', time: '09:00', enabled: true }];
  const second = [{ id: '1', text: 'Новое', time: '10:00', enabled: true }];
  syncRemindersToExtension(first);
  syncRemindersToExtension(second);
  await vi.waitFor(() => expect(set).toHaveBeenCalledTimes(1));
  expect(sendMessage).not.toHaveBeenCalled();
  release();
  await vi.waitFor(() => expect(sendMessage).toHaveBeenCalledTimes(2));
  expect(set.mock.calls).toEqual([[{ planer_reminders: first }], [{ planer_reminders: second }]]);
  expect(set.mock.invocationCallOrder[0]).toBeLessThan(sendMessage.mock.invocationCallOrder[0]);
  expect(sendMessage.mock.invocationCallOrder[0]).toBeLessThan(set.mock.invocationCallOrder[1]);
});

it('keeps the message channel open and serializes background alarm updates', async () => {
  let listener!: (msg: unknown, sender: unknown, reply: (value: unknown) => void) => boolean;
  let release!: () => void;
  const firstClear = new Promise<void>(resolve => { release = resolve; });
  const clearAll = vi.fn().mockImplementationOnce(() => firstClear).mockResolvedValue(undefined);
  const event = () => ({ addListener: vi.fn() });
  const chrome = {
    alarms: { clearAll, create: vi.fn(), onAlarm: event() },
    storage: { local: { get: vi.fn().mockResolvedValue({ planer_reminders: [] }) } },
    runtime: { onInstalled: event(), onStartup: event(), onMessage: { addListener: (fn: typeof listener) => { listener = fn; } } },
    notifications: { onClicked: event() }, action: { onClicked: event() },
    omnibox: { setDefaultSuggestion: vi.fn(), onInputEntered: event() },
  };
  runInNewContext(readFileSync('chrome-extension/background.js', 'utf8'), { chrome, console, Date, Promise });
  const firstReply = vi.fn(), secondReply = vi.fn();
  expect(listener({ type: 'reschedule' }, null, firstReply)).toBe(true);
  expect(listener({ type: 'reschedule' }, null, secondReply)).toBe(true);
  await vi.waitFor(() => expect(clearAll).toHaveBeenCalledTimes(1));
  expect(firstReply).not.toHaveBeenCalled();
  release();
  await vi.waitFor(() => expect(secondReply).toHaveBeenCalledWith({ ok: true }));
  expect(clearAll).toHaveBeenCalledTimes(2);
  expect(firstReply).toHaveBeenCalledWith({ ok: true });
});
