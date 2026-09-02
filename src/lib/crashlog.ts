/** Локальный кольцевой журнал ошибок. Ничего не отправляет наружу —
 *  пользователь сам копирует отчёт и присылает его в issue. */

const KEY = 'thedad.crashlog.v1';
const KEEP = 20;

export interface CrashEntry {
  ts: number;
  message: string;
  stack?: string;
  /** 'error' — window.onerror, 'promise' — unhandledrejection, 'render' — ErrorBoundary */
  kind: 'error' | 'promise' | 'render';
}

export function loadCrashes(): CrashEntry[] {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
}

export function recordCrash(kind: CrashEntry['kind'], error: unknown, extra?: string) {
  try {
    const err = error instanceof Error ? error : new Error(String(error));
    const entry: CrashEntry = {
      ts: Date.now(),
      kind,
      message: err.message,
      // Стек режем: длинный стек из минифицированного бандла бесполезен и распухает localStorage.
      stack: [extra, err.stack].filter(Boolean).join('\n').slice(0, 2000),
    };
    localStorage.setItem(KEY, JSON.stringify([entry, ...loadCrashes()].slice(0, KEEP)));
  } catch {
    // Журнал ошибок не имеет права сам стать источником ошибки.
  }
}

export function clearCrashes() {
  try { localStorage.removeItem(KEY); } catch {}
}

/** Текст для кнопки «скопировать отчёт»: окружение + последние ошибки. */
export function buildCrashReport(): string {
  const env = [
    `THEDAD ${__APP_VERSION__}`,
    `UA: ${navigator.userAgent}`,
    `Время: ${new Date().toISOString()}`,
    `Язык: ${navigator.language}`,
  ].join('\n');
  const list = loadCrashes()
    .map((c) => `--- ${new Date(c.ts).toISOString()} [${c.kind}]\n${c.message}\n${c.stack ?? ''}`)
    .join('\n\n');
  return `${env}\n\n${list || 'Ошибок не записано.'}`;
}

let bound = false;
/** Вешает глобальные обработчики. Вызывать один раз при старте. */
export function bindCrashHandlers() {
  if (bound) return;
  bound = true;
  window.addEventListener('error', (e) => recordCrash('error', e.error ?? e.message));
  window.addEventListener('unhandledrejection', (e) => recordCrash('promise', e.reason));
}
