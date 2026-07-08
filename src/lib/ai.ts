/** Настройки AI-коуча. Ключ хранится ЛОКАЛЬНО (localStorage), запросы идут напрямую к провайдеру. */

const KEY = 'thedad.ai.key';
const ENDPOINT = 'thedad.ai.endpoint';
const MODEL = 'thedad.ai.model';

const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';

export interface AiConfig {
  key: string;
  endpoint: string;
  model: string;
}

export function getAiConfig(): AiConfig {
  return {
    key: localStorage.getItem(KEY) ?? '',
    endpoint: localStorage.getItem(ENDPOINT) || DEFAULT_ENDPOINT,
    model: localStorage.getItem(MODEL) || DEFAULT_MODEL,
  };
}

export function setAiConfig(cfg: Partial<AiConfig>) {
  if (cfg.key !== undefined) localStorage.setItem(KEY, cfg.key);
  if (cfg.endpoint !== undefined) localStorage.setItem(ENDPOINT, cfg.endpoint || DEFAULT_ENDPOINT);
  if (cfg.model !== undefined) localStorage.setItem(MODEL, cfg.model || DEFAULT_MODEL);
}

export function hasAiKey(): boolean {
  try { return Boolean(localStorage.getItem(KEY)); } catch { return false; }
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

/** Реальный вызов OpenAI-совместимого chat/completions. Работает с OpenAI, OpenRouter, локальными LLM. */
export async function askAI(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const { key, endpoint, model } = getAiConfig();
  if (!key) throw new Error('API-ключ не задан');
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: 600 }),
    signal,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Ошибка провайдера ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Пустой ответ от модели');
  return content.trim();
}
