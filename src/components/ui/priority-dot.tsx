import { useState } from 'react';

/** Важность задачи: 5 уровней с разными цветами (единый источник для всех экранов).
 *  1 — срочно, 3 — обычный (по умолчанию), 5 — фоновая. Меньше число = выше в списке. */
export const PRIORITY_COLOR: Record<number, string> = {
  1: '#ef4444', // красный — срочно
  2: '#f97316', // оранжевый — высокий
  3: '#22c55e', // зелёный — обычный (по умолчанию)
  4: '#3b82f6', // синий — низкий
  5: '#cbd5e1', // светлый — фоновая
};
export const PRIORITY_LABEL: Record<number, string> = {
  1: 'Срочно', 2: 'Высокий', 3: 'Обычный', 4: 'Низкий', 5: 'Фоновая',
};
export const PRIORITY_LEVELS = [1, 2, 3, 4, 5];
export const DEFAULT_PRIORITY = 3;
export const priorityColor = (p: number) => PRIORITY_COLOR[p] ?? PRIORITY_COLOR[3];

/** Минималистичный цветной кружок важности: клик → палитра из 5 цветов.
 *  Работает в светлой (default) и тёмной (dark — для Focus Mode) темах. */
export const PriorityDot: React.FC<{
  priority: number;
  onChange: (p: number) => void;
  tone?: 'light' | 'dark';
  size?: number;
  title?: string;
}> = ({ priority, onChange, tone = 'light', size = 10, title }) => {
  const [open, setOpen] = useState(false);
  const pop = tone === 'dark' ? 'bg-[#1c1b26] border-white/10' : 'bg-bg-card border-border-soft';
  return (
    <span className="relative inline-flex shrink-0 items-center">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-full transition-transform hover:scale-125"
        style={{ background: priorityColor(priority), width: size, height: size }}
        title={title ?? `${PRIORITY_LABEL[priority] ?? 'Важность'} — клик, чтобы изменить`}
      />
      {open && (
        <>
          {/* клик вне палитры закрывает её */}
          <span className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <span className={`absolute z-50 top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-2 py-1.5 rounded-full border shadow-lg ${pop}`}>
            {PRIORITY_LEVELS.map((p) => (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false); }}
                className="h-4 w-4 rounded-full transition-transform hover:scale-125"
                style={{ background: PRIORITY_COLOR[p], outline: p === priority ? '2px solid currentColor' : 'none', outlineOffset: '1px' }}
                title={PRIORITY_LABEL[p]}
              />
            ))}
          </span>
        </>
      )}
    </span>
  );
};
