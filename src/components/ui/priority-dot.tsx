import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/** Важность / цветовая метка задачи: 10 уровней с разными цветами (единый источник для всех экранов).
 *  1 — срочно, 3 — обычный (по умолчанию). Меньше число = выше в списке. 6–10 — дополнительные метки. */
export const PRIORITY_COLOR: Record<number, string> = {
  1: '#ef4444', // красный — срочно
  2: '#f97316', // оранжевый — высокий
  3: '#22c55e', // зелёный — обычный (по умолчанию)
  4: '#3b82f6', // синий — низкий
  5: '#cbd5e1', // светло-серый — фоновая
  6: '#a855f7', // фиолетовый
  7: '#ec4899', // розовый
  8: '#14b8a6', // бирюзовый
  9: '#eab308', // жёлтый
  10: '#ffffff', // белый
};
export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Срочно', 2: 'Высокий', 3: 'Обычный', 4: 'Низкий', 5: 'Фоновая',
  6: 'Фиолетовая', 7: 'Розовая', 8: 'Бирюзовая', 9: 'Жёлтая', 10: 'Белая',
};
export const PRIORITY_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const DEFAULT_PRIORITY = 3;
export const priorityColor = (p: number) => PRIORITY_COLOR[p] ?? PRIORITY_COLOR[3];

/** Минималистичный цветной кружок важности: клик → палитра цветов.
 *  Палитра рендерится порталом в body с fixed-позиционированием — не обрезается панелями/скроллом.
 *  Работает в светлой (default) и тёмной (dark — для Focus Mode) темах. */
export const PriorityDot: React.FC<{
  priority: number;
  onChange: (p: number) => void;
  tone?: 'light' | 'dark';
  size?: number;
  title?: string;
}> = ({ priority, onChange, tone = 'light', size = 10, title }) => {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const pop = tone === 'dark'
    ? 'bg-[#1c1b26] border-white/10 text-white/70'
    : 'bg-bg-card border-border-soft text-text';

  // Позиционируем палитру под кружком; если снизу мало места — над ним. Клампим по краям экрана.
  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const PW = 232, PH = 44, GAP = 8;
    let top = r.bottom + GAP;
    if (top + PH > window.innerHeight - 8) top = r.top - PH - GAP; // не влезает снизу — показываем сверху
    let left = r.left + r.width / 2 - PW / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - PW - 8));
    setPos({ top, left });
  }, [open]);

  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-full transition-transform hover:scale-125"
        style={{ background: priorityColor(priority), width: size, height: size, border: '1px solid rgba(0,0,0,0.15)' }}
        title={title ?? `${PRIORITY_LABEL[priority] ?? 'Важность'} — клик, чтобы изменить`}
      />
      {open && createPortal(
        <>
          {/* клик вне палитры закрывает её */}
          <div className="fixed inset-0 z-[300]" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <div
            className={`fixed z-[301] flex flex-wrap items-center gap-2 p-2 rounded-xl border shadow-xl ${pop}`}
            style={{ top: pos.top, left: pos.left, width: 232 }}
            onClick={(e) => e.stopPropagation()}
          >
            {PRIORITY_LEVELS.map((p) => (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false); }}
                className="h-5 w-5 rounded-full transition-transform hover:scale-125"
                style={{ background: PRIORITY_COLOR[p], outline: p === priority ? '2px solid currentColor' : '1px solid rgba(0,0,0,0.12)', outlineOffset: '1px' }}
                title={PRIORITY_LABEL[p]}
              />
            ))}
          </div>
        </>,
        document.body,
      )}
    </span>
  );
};
