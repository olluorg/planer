/** Единая точка вызова AI: встроенный в Chrome ИИ (Prompt API / Gemini Nano — «Gemma в браузере»)
 *  с фолбэком на свой API-ключ (lib/ai.ts). Провайдер выбирается автоматически:
 *  chrome-builtin (если доступен и не отключён пользователем) → свой ключ → ошибка. */
import { askAI, aiConfigured, type ChatMessage } from './ai';

export type Availability = 'available' | 'downloadable' | 'downloading' | 'unavailable';
export type ProviderKind = 'chrome' | 'key' | 'none';

// Chrome отдаёт либо новый глобальный `LanguageModel`, либо старый `window.ai.languageModel`.
function getLM(): any {
  const g = globalThis as any;
  return g.LanguageModel ?? g.ai?.languageModel ?? null;
}

/** Встроенный AI вообще присутствует в этом браузере (без учёта готовности модели). */
export function chromeAiPresent(): boolean {
  return !!getLM();
}

const PREF_KEY = 'thedad.ai.prefer-chrome'; // '0' — пользователь отключил встроенный AI
export function chromePreferred(): boolean {
  try { return localStorage.getItem(PREF_KEY) !== '0'; } catch { return true; }
}
export function setChromePreferred(on: boolean) {
  try { localStorage.setItem(PREF_KEY, on ? '1' : '0'); } catch {}
}

/** Готовность модели встроенного AI. Поддерживает и новый availability(), и старый capabilities(). */
export async function chromeAvailability(): Promise<Availability> {
  const lm = getLM();
  if (!lm) return 'unavailable';
  try {
    if (typeof lm.availability === 'function') return await lm.availability();
    if (typeof lm.capabilities === 'function') {
      const a = (await lm.capabilities())?.available;
      return a === 'readily' ? 'available' : a === 'after-download' ? 'downloadable' : 'unavailable';
    }
  } catch {}
  return 'unavailable';
}

/** Модель Gemini Nano весит порядка гигабайта и качается один раз.
 *  create() при статусе downloadable ТРЕБУЕТ пользовательский жест — вызывать только из обработчика клика. */
export async function downloadChromeModel(onProgress?: (pct: number) => void): Promise<void> {
  const lm = getLM();
  if (!lm) throw new Error('Встроенный AI недоступен в этом браузере');
  const session = await lm.create({
    monitor(m: any) {
      m.addEventListener('downloadprogress', (e: any) => {
        const pct = e.total ? Math.round((e.loaded / e.total) * 100) : Math.round((e.loaded ?? 0) * 100);
        onProgress?.(Math.min(100, Math.max(0, pct)));
      });
    },
  });
  session.destroy?.();
}

/** Ошибки встроенного AI приходят по-английски и невнятно — переводим в понятное действие. */
function friendlyChromeError(e: any): Error {
  const msg = String(e?.message ?? e);
  if (/user gesture/i.test(msg)) {
    return new Error('Модель встроенного AI ещё не скачана. Открой Настройки → «Встроенный AI Chrome» и нажми «Скачать модель» (один раз, ~1–2 ГБ).');
  }
  return new Error(`Встроенный AI: ${msg}`);
}

async function chromePrompt(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const lm = getLM();
  if (!lm) throw new Error('Встроенный AI недоступен');
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const convo = messages.filter((m) => m.role !== 'system');
  const opts: any = {};
  if (system) opts.initialPrompts = [{ role: 'system', content: system }];
  if (signal) opts.signal = signal;
  let session: any;
  try { session = await lm.create(opts); }
  catch (e) { throw friendlyChromeError(e); }
  try {
    const text = convo.map((m) => (m.role === 'user' ? m.content : `Ассистент: ${m.content}`)).join('\n\n');
    const reply = await session.prompt(text, signal ? { signal } : undefined);
    return String(reply).trim();
  } finally {
    session.destroy?.();
  }
}

/** Какой провайдер сейчас доступен (для индикатора «онлайн» и подсказок в UI). */
export async function resolveProvider(): Promise<ProviderKind> {
  if (chromePreferred() && chromeAiPresent()) {
    const a = await chromeAvailability();
    if (a === 'available' || a === 'downloadable' || a === 'downloading') return 'chrome';
  }
  if (aiConfigured()) return 'key';
  return 'none';
}

/** Синхронная грубая оценка доступности (для первичного рендера без await). */
export function aiMaybeAvailable(): boolean {
  return (chromePreferred() && chromeAiPresent()) || aiConfigured();
}

/** Основной вызов модели: встроенный Chrome AI → при сбое/отсутствии фолбэк на свой ключ. */
export async function askAny(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const provider = await resolveProvider();
  if (provider === 'chrome') {
    try {
      return await chromePrompt(messages, signal);
    } catch (e) {
      if (aiConfigured()) return askAI(messages, signal); // тихий фолбэк на ключ
      throw e;
    }
  }
  if (provider === 'key') return askAI(messages, signal);
  throw new Error('AI недоступен: включи встроенный AI Chrome (chrome://flags → Prompt API) или добавь API-ключ в Настройках');
}
