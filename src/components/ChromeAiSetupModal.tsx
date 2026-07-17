import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Copy, Check, Cpu, TriangleAlert } from 'lucide-react';

/** Адрес chrome:// нельзя открыть ссылкой со страницы — только скопировать и вставить в адресную строку. */
const CopyAddr: React.FC<{ addr: string }> = ({ addr }) => {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(addr); setDone(true); setTimeout(() => setDone(false), 1500); } catch {}
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 rounded-lg bg-bg-soft border border-border-soft px-2 py-1 font-mono text-[12px] text-accent hover:border-border transition-colors"
      title="Скопировать адрес"
    >
      {addr}
      {done ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3 text-text-dim" />}
    </button>
  );
};

const STEPS: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Обнови Chrome',
    body: <>Нужен Chrome последней версии на компьютере (Windows / macOS / Linux). Проверка: <CopyAddr addr="chrome://settings/help" /> — скопируй адрес, вставь в адресную строку и нажми Enter.</>,
  },
  {
    title: 'Включи Prompt API',
    body: <>Открой <CopyAddr addr="chrome://flags/#prompt-api-for-gemini-nano" /> и поставь <b>Enabled</b>.</>,
  },
  {
    title: 'Включи загрузку модели',
    body: <>Открой <CopyAddr addr="chrome://flags/#optimization-guide-on-device-model" /> и поставь <b>Enabled BypassPerfRequirement</b>.</>,
  },
  {
    title: 'Перезапусти Chrome',
    body: <>Нажми кнопку <b>Relaunch</b> внизу страницы флагов (или закрой и открой браузер).</>,
  },
  {
    title: 'Скачай модель',
    body: <>Вернись в THEDAD → Настройки → «Встроенный AI Chrome» → <b>«Скачать модель»</b> (~1–2 ГБ, один раз). После загрузки статус станет «Готов к работе».</>,
  },
];

/** Пошаговая инструкция «как включить бесплатный AI в Chrome» (Gemini Nano / Prompt API). */
export const ChromeAiSetupModal: React.FC<{ open: boolean; onOpenChange: (v: boolean) => void }> = ({ open, onOpenChange }) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2"><Cpu className="h-4 w-4 text-accent" /> Бесплатный AI в Chrome</DialogTitle>
        <DialogDescription>
          Gemini Nano работает прямо в браузере: бесплатно, офлайн, данные не покидают компьютер.
          Включается один раз за пару минут.
        </DialogDescription>
      </DialogHeader>

      <ol className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="h-6 w-6 shrink-0 rounded-full bg-accent/12 text-accent text-xs font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
            <div className="min-w-0 pt-0.5">
              <div className="text-sm font-medium text-text">{s.title}</div>
              <div className="text-[13px] text-text-muted leading-relaxed mt-0.5">{s.body}</div>
            </div>
          </li>
        ))}
      </ol>

      <div className="mt-4 rounded-xl bg-bg-soft p-3 text-[12px] text-text-muted leading-relaxed space-y-1.5">
        <div className="flex items-start gap-2">
          <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5 text-text-dim" />
          <span>
            Не помогло? Открой <CopyAddr addr="chrome://components" />, найди <b>Optimization Guide On Device Model</b> и
            нажми «Проверить обновления». Модели нужно ~2 ГБ свободного места и не самая слабая видеокарта.
          </span>
        </div>
        <div className="pl-5.5 text-text-dim">
          В других браузерах (Safari, Firefox, на телефоне) встроенный AI недоступен — там используй свой ключ
          OpenAI / Claude / Gemini или локальную Ollama (Настройки → AI-коуч).
        </div>
      </div>
    </DialogContent>
  </Dialog>
);
