import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Info, Github, ShieldCheck, HeartHandshake, Cpu, Copy, Check,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from '@/lib/toast';

/** Экран «О приложении» — версия, суть THEDAD, приватность, ссылки, благодарности.
 *  Открывается из Настроек. Данные, не логика: правки = правки констант ниже. */

export const APP_VERSION = '2.0.0';
const REPO_URL = 'https://github.com/uyellowline/planer';

const FEATURES: { emoji: string; text: string }[] = [
  { emoji: '🎯', text: 'Focus Mode — помодоро и таймер со звуками, задачами и живым фоном' },
  { emoji: '🧩', text: 'Дашборд-конструктор из виджетов и несколько экранов' },
  { emoji: '❤️', text: 'Здоровье: калории, активность, зарядка — цели двигаются сами' },
  { emoji: '🤖', text: 'AI-планы через встроенный Chrome-AI или свой ключ' },
  { emoji: '📋', text: 'Задачи, привычки, цели, канбан и аналитика' },
];

const TECH = ['React', 'Vite', 'SQLite WASM', 'IndexedDB', 'Tailwind', 'zustand'];

const Row: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({ icon, title, children }) => (
  <div className="flex gap-3">
    <span className="h-9 w-9 shrink-0 rounded-lg bg-accent/10 text-accent flex items-center justify-center">{icon}</span>
    <div className="min-w-0">
      <div className="text-sm font-semibold text-text mb-0.5">{title}</div>
      <div className="text-[13px] text-text-muted leading-relaxed">{children}</div>
    </div>
  </div>
);

export const AboutModal: React.FC<{ open: boolean; onClose: () => void }> = ({ open, onClose }) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) { setCopied(false); return; }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const copyVersion = async () => {
    try {
      await navigator.clipboard.writeText(`THEDAD ${APP_VERSION}`);
      setCopied(true);
      toast.info('Версия скопирована');
      setTimeout(() => setCopied(false), 1500);
    } catch { /* буфер недоступен — не критично */ }
  };

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div className="modal-surface relative z-10 w-full max-w-2xl max-h-[90vh] rounded-2xl bg-bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border-soft shrink-0">
          <Info className="h-5 w-5 text-accent shrink-0" />
          <div className="text-sm font-semibold text-text flex-1 truncate">О приложении</div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text shrink-0" title="Закрыть (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Шапка: логотип-эмодзи, название, версия */}
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 rounded-2xl bg-accent/12 flex items-center justify-center text-3xl">🗓️</div>
            <div className="min-w-0">
              <div className="text-xl font-bold text-text">THEDAD</div>
              <div className="text-sm text-text-muted">Личный планер, который живёт на твоём устройстве</div>
              <button
                onClick={copyVersion}
                className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-bg-soft hover:bg-bg-hover border border-border-soft px-2.5 py-0.5 text-[11px] text-text-muted hover:text-text transition-colors"
                title="Скопировать версию"
              >
                v{APP_VERSION}
                {copied ? <Check className="h-3 w-3 text-accent" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          </div>

          {/* Что умеет */}
          <div>
            <div className="text-[11px] uppercase tracking-widest text-text-dim mb-2.5">Что умеет</div>
            <ul className="space-y-2">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex gap-2.5 text-[13px] text-text leading-relaxed">
                  <span className="shrink-0">{f.emoji}</span>
                  <span>{f.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4">
            <Row icon={<ShieldCheck className="h-4.5 w-4.5" />} title="Приватность прежде всего">
              Все данные хранятся локально в браузере (SQLite в IndexedDB). Ничего не уходит в облако
              без твоего действия — синхронизация только файлом или по QR между своими устройствами.
            </Row>
            <Row icon={<Cpu className="h-4.5 w-4.5" />} title="На чём сделано">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TECH.map((t) => (
                  <span key={t} className="rounded-md bg-bg-soft border border-border-soft px-2 py-0.5 text-[11px] text-text-muted">{t}</span>
                ))}
              </div>
            </Row>
            <Row icon={<HeartHandshake className="h-4.5 w-4.5" />} title="Открытый проект">
              THEDAD с открытым исходным кодом. Идеи, баги и плагины — всегда welcome.
            </Row>
          </div>

          {/* Ссылки */}
          <div className="flex flex-wrap gap-2 pt-1">
            <a
              href={REPO_URL}
              target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-lg bg-bg-soft hover:bg-bg-hover border border-border-soft px-3.5 py-2 text-sm text-text transition-colors"
            >
              <Github className="h-4 w-4" /> Исходный код
            </a>
          </div>

          <p className="text-[11px] text-text-dim leading-relaxed pt-2 border-t border-border-soft">
            Сделано с ❤️ для тех, кто хочет держать свой день под контролем, а данные — при себе.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
};
