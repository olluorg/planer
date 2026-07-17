import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Plus, Upload } from 'lucide-react';
import { WIDGET_CATEGORY_LABEL, type WidgetCategory, type WidgetMeta } from '@/lib/widgetCatalog';
import { installPlugin } from '@/lib/plugins';
import { toast } from '@/lib/toast';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Доступные, но не размещённые на сетке виджеты (включая плагины). */
  available: WidgetMeta[];
  onAdd: (meta: WidgetMeta) => void;
  /** Живое превью виджета (реальный компонент с данными пользователя), как в галереях iOS/Android. */
  renderPreview?: (id: string) => React.ReactNode;
}

/** Масштабированный «снимок» виджета: рендерим настоящий компонент в фиксированный
 *  холст и уменьшаем transform-ом; клики внутрь не проходят. */
const Preview: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="relative h-40 rounded-lg overflow-hidden border border-border-soft bg-bg-soft/40 pointer-events-none select-none">
    <div className="absolute left-1/2 top-2 -translate-x-1/2" style={{ width: 560, height: 316, transform: 'translateX(-50%) scale(0.52)', transformOrigin: 'top center' }}>
      <div className="h-full w-full">{children}</div>
    </div>
  </div>
);

/** Окно «Добавить виджет»: все доступные, но не размещённые виджеты с фильтром по категориям. */
export const WidgetPicker: React.FC<Props> = ({ open, onClose, available, onAdd, renderPreview }) => {
  const [cat, setCat] = useState<'all' | WidgetCategory>('all');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  // Показываем только категории, в которых есть виджеты (+ Плагины всегда: там импорт)
  const cats = useMemo(() => {
    const present = new Set(available.map((m) => m.category));
    present.add('plugins');
    return (Object.keys(WIDGET_CATEGORY_LABEL) as WidgetCategory[]).filter((c) => present.has(c));
  }, [available]);

  const list = useMemo(
    () => (cat === 'all' ? available : available.filter((m) => m.category === cat)),
    [available, cat],
  );

  const importPlugin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const p = installPlugin(JSON.parse(await file.text()));
      toast.success(`Плагин «${p.name}» установлен`);
      setCat('plugins');
    } catch (err) {
      toast.error(`Плагин не установлен: ${err instanceof Error ? err.message : 'не удалось прочитать файл'}`);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[160] flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-3xl max-h-[85vh] rounded-2xl bg-bg-card border border-border shadow-2xl overflow-hidden flex flex-col animate-[slide-up_200ms_ease-out]">
        {/* Шапка */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <div>
            <div className="text-base font-semibold text-text">Добавить виджет</div>
            <div className="text-xs text-text-muted mt-0.5">Виджеты, которых ещё нет на дашборде</div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted hover:text-text transition-colors"
            title="Закрыть (Esc)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Категории */}
        <div className="flex gap-1.5 px-5 pb-3 overflow-x-auto shrink-0" style={{ scrollbarWidth: 'none' }}>
          {(['all', ...cats] as const).map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                cat === c ? 'bg-accent text-white' : 'bg-bg-soft text-text-muted hover:text-text hover:bg-bg-hover'
              }`}
            >
              {c === 'all' ? 'Все' : WIDGET_CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {/* Сетка виджетов */}
        <div className="flex-1 overflow-y-auto px-5 pb-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {list.map((m) => {
              const preview = renderPreview?.(m.id);
              return (
                // div (не button): в превью попадают интерактивные элементы (чекбоксы = button),
                // а button-в-button — невалидная вложенность DOM
                <div
                  key={m.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onAdd(m)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAdd(m); } }}
                  className="group flex flex-col gap-2.5 rounded-xl border border-border-soft bg-bg-soft/50 hover:border-accent/40 hover:bg-accent/5 p-3 text-left transition-colors cursor-pointer"
                >
                  {/* Полноценное превью виджета с реальными данными, как в галереях iOS/Android */}
                  {preview && <Preview>{preview}</Preview>}
                  <span className="flex items-start gap-2.5 w-full">
                    <span className="h-8 w-8 rounded-lg bg-bg-card border border-border-soft flex items-center justify-center shrink-0 text-accent">
                      <m.icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-text truncate">{m.label}</span>
                      <span className="block text-xs text-text-muted mt-0.5 leading-snug">{m.description}</span>
                    </span>
                    <span className="h-7 w-7 rounded-lg flex items-center justify-center text-text-dim group-hover:text-accent group-hover:bg-accent/10 transition-colors shrink-0">
                      <Plus className="h-4 w-4" />
                    </span>
                  </span>
                </div>
              );
            })}

            {/* Импорт своего виджета-плагина (.thedad-widget.json) */}
            {(cat === 'all' || cat === 'plugins') && (
              <button
                onClick={() => fileRef.current?.click()}
                className="flex items-start gap-3 rounded-xl border border-dashed border-border hover:border-accent/60 p-3.5 text-left transition-colors"
              >
                <span className="h-9 w-9 rounded-lg bg-bg-soft flex items-center justify-center shrink-0 text-text-muted">
                  <Upload className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-text">Импортировать виджет</span>
                  <span className="block text-xs text-text-muted mt-0.5 leading-snug">
                    Файл .thedad-widget.json — свой или от сообщества. Без кода, только данные.
                  </span>
                </span>
              </button>
            )}
          </div>

          {list.length === 0 && cat !== 'plugins' && cat !== 'all' && (
            <div className="py-10 text-center text-sm text-text-dim">В этой категории всё уже на дашборде</div>
          )}
        </div>

        <input ref={fileRef} type="file" accept=".json,application/json" className="hidden" onChange={importPlugin} />
      </div>
    </div>
  );
};
