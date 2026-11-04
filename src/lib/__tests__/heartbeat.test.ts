// @vitest-environment happy-dom
import { afterEach, expect, it, vi } from 'vitest';
import { HEARTBEAT_EVENT, scheduleHeartbeat, setHeartbeatEnabled } from '../notifications';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); localStorage.clear(); });

it('replans notification timers when the setting changes', () => {
  vi.useFakeTimers();
  vi.stubGlobal('Notification', { permission: 'granted' });
  const providers = { morningBody: () => 'Утро', eveningBody: () => 'Вечер' };
  const reschedule = () => scheduleHeartbeat(providers);
  window.addEventListener(HEARTBEAT_EVENT, reschedule);
  try {
    setHeartbeatEnabled(true);
    expect(vi.getTimerCount()).toBe(2);
    setHeartbeatEnabled(false);
    expect(vi.getTimerCount()).toBe(0);
  } finally { window.removeEventListener(HEARTBEAT_EVENT, reschedule); }
});
