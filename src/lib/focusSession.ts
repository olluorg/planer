/** Персист состояния Focus Mode: таймер переживает перезагрузку страницы и открытие в новой
 *  вкладке. Храним endsAt (когда закончится текущая фаза) — при рестарте пересчитываем остаток
 *  от реального времени, поэтому таймер не «сбивается». */

export interface FocusSession {
  running: boolean;
  phase: 'work' | 'rest';
  pomodoro: boolean;
  cycleIdx: number;
  timerIdx: number;
  selectedId: string | null;
  endsAt: number | null;   // ms epoch — момент конца текущей фазы (когда running)
  secondsLeft: number;     // остаток на паузе/стопе
}

const KEY = 'focus.session.v1';

export function loadFocusSession(): FocusSession | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}

export function saveFocusSession(s: FocusSession | null) {
  try {
    if (s) localStorage.setItem(KEY, JSON.stringify(s));
    else localStorage.removeItem(KEY);
  } catch {}
}

/** Идёт ли активная сессия прямо сейчас (для авто-открытия фокуса в новой вкладке/после перезагрузки). */
export function focusShouldResume(): boolean {
  const s = loadFocusSession();
  return !!(s && s.running && s.endsAt && s.endsAt > Date.now());
}
