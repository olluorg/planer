import { useEffect } from 'react';
import { X } from 'lucide-react';

/** Раскрытие виджета в страницу: почти-полноэкранная модалка поверх дашборда.
 *  Внутри рендерится существующая страница (Habits/Goals/…). Закрытие — Esc / клик по фону. */
export const WidgetExpandModal: React.FC<{
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    // блокируем прокрутку фона, пока модалка открыта
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-start justify-center p-2 sm:p-5" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-[1400px] h-[94vh] rounded-2xl bg-bg border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-30 h-9 w-9 rounded-lg bg-bg-soft/90 hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text transition-colors"
          title="Закрыть (Esc)"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
};
