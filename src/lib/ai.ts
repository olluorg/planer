/** Настройки AI-коуча. Ключ хранится ЛОКАЛЬНО (localStorage), запросы идут напрямую к провайдеру.
 *  Поддержаны OpenAI, Claude (Anthropic), Gemini (Google) и любой OpenAI-совместимый endpoint —
 *  у всех троих разный формат запроса/ответа, поэтому askAI разводит их по веткам. */

const KEY = 'thedad.ai.key';
const ENDPOINT = 'thedad.ai.endpoint';
const MODEL = 'thedad.ai.model';
const PROVIDER = 'thedad.ai.provider';

export type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'ollama' | 'custom';

export const AI_PROVIDERS: { id: AiProvider; label: string; endpoint: string; model: string; hint: string }[] = [
  { id: 'openai',    label: 'OpenAI',  endpoint: 'https://api.openai.com/v1/chat/completions',        model: 'gpt-4o-mini',      hint: 'Ключ sk-… из platform.openai.com' },
  { id: 'anthropic', label: 'Claude',  endpoint: 'https://api.anthropic.com/v1/messages',             model: 'claude-opus-4-8',  hint: 'Ключ из console.anthropic.com' },
  { id: 'gemini',    label: 'Gemini',  endpoint: 'https://generativelanguage.googleapis.com/v1beta/models', model: 'gemini-2.0-flash', hint: 'Ключ из aistudio.google.com' },
  { id: 'ollama',    label: 'Ollama (локально)', endpoint: 'http://localhost:11434/v1/chat/completions', model: 'gemma3:4b',     hint: 'Без ключа. Модель на твоём компьютере — docker compose из README поднимает всё сам' },
  { id: 'custom',    label: 'Свой',    endpoint: '',                                                  model: '',                 hint: 'Любой OpenAI-совместимый: OpenRouter, локальная LLM' },
];

const metaOf = (p: AiProvider) => AI_PROVIDERS.find((x) => x.id === p) ?? AI_PROVIDERS[0];

export interface AiConfig {
  provider: AiProvider;
  key: string;
  endpoint: string;
  model: string;
}

export function getAiConfig(): AiConfig {
  const provider = (localStorage.getItem(PROVIDER) as AiProvider) || 'openai';
  const meta = metaOf(provider);
  return {
    provider,
    key: localStorage.getItem(KEY) ?? '',
    endpoint: localStorage.getItem(ENDPOINT) || meta.endpoint,
    model: localStorage.getItem(MODEL) || meta.model,
  };
}

export function setAiConfig(cfg: Partial<AiConfig>) {
  // Смена провайдера сбрасывает endpoint/model на дефолты этого провайдера —
  // иначе к Claude уедет endpoint OpenAI и запрос уйдёт в никуда.
  if (cfg.provider !== undefined) {
    localStorage.setItem(PROVIDER, cfg.provider);
    const meta = metaOf(cfg.provider);
    if (cfg.endpoint === undefined) localStorage.setItem(ENDPOINT, meta.endpoint);
    if (cfg.model === undefined) localStorage.setItem(MODEL, meta.model);
  }
  if (cfg.key !== undefined) localStorage.setItem(KEY, cfg.key);
  if (cfg.endpoint !== undefined) localStorage.setItem(ENDPOINT, cfg.endpoint);
  if (cfg.model !== undefined) localStorage.setItem(MODEL, cfg.model);
}

export function hasAiKey(): boolean {
  try { return Boolean(localStorage.getItem(KEY)); } catch { return false; }
}

/** Провайдер готов к работе: есть ключ, либо выбран Ollama (локальный, ключ не нужен). */
export function aiConfigured(): boolean {
  return hasAiKey() || getAiConfig().provider === 'ollama';
}

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }

async function fail(res: Response): Promise<never> {
  const txt = await res.text().catch(() => '');
  throw new Error(`Ошибка провайдера ${res.status}: ${txt.slice(0, 200)}`);
}

/** OpenAI-совместимый chat/completions (OpenAI, OpenRouter, локальные LLM). */
async function askOpenAi(cfg: AiConfig, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.key}` },
    body: JSON.stringify({ model: cfg.model, messages, temperature: 0.6, max_tokens: 600 }),
    signal,
  });
  if (!res.ok) await fail(res);
  const content = (await res.json())?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error('Пустой ответ от модели');
  return content.trim();
}

/** Anthropic Messages API. system идёт отдельным полем, ответ — массив блоков content.
 *  Заголовок anthropic-dangerous-direct-browser-access разрешает вызов прямо из браузера. */
async function askAnthropic(cfg: AiConfig, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const rest = messages.filter((m) => m.role !== 'system').map((m) => ({ role: m.role, content: m.content }));
  const res = await fetch(cfg.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': cfg.key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({ model: cfg.model, max_tokens: 1024, ...(system ? { system } : {}), messages: rest }),
    signal,
  });
  if (!res.ok) await fail(res);
  const data = await res.json();
  const text = data?.content?.find((b: any) => b?.type === 'text')?.text;
  if (typeof text !== 'string') throw new Error('Пустой ответ от модели');
  return text.trim();
}

/** Google Gemini generateContent. Ключ шлём заголовком (не в URL — он утекает в логи/историю). */
async function askGemini(cfg: AiConfig, messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const base = cfg.endpoint.replace(/\/+$/, '');
  const res = await fetch(`${base}/${cfg.model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.key },
    body: JSON.stringify({ ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}), contents }),
    signal,
  });
  if (!res.ok) await fail(res);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text).filter(Boolean).join('');
  if (!text) throw new Error('Пустой ответ от модели');
  return String(text).trim();
}

/** Запрос к выбранному провайдеру своим ключом. */
export async function askAI(messages: ChatMessage[], signal?: AbortSignal): Promise<string> {
  const cfg = getAiConfig();
  // Ollama авторизацию игнорирует, но OpenAI-совместимый клиентский код шлёт Bearer — подставляем заглушку
  if (cfg.provider === 'ollama' && !cfg.key) cfg.key = 'ollama';
  if (!cfg.key) throw new Error('API-ключ не задан');
  if (cfg.provider === 'anthropic') return askAnthropic(cfg, messages, signal);
  if (cfg.provider === 'gemini') return askGemini(cfg, messages, signal);
  return askOpenAi(cfg, messages, signal);
}
