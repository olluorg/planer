import { useState } from 'react';

/** Цвета важности задачи — единый источник для всех экранов. */
export const PRIORITY_COLOR: Record<number, string> = { 1: '#ef4444', 2: '#f59e0b', 3: '#64748b' };
export const PRIORITY_LABEL: Record<number, string> = { 1: 'Высокий', 2: 'Средний', 3: 'Низкий' };

/** Цветной кружок важности: клик → палитра из трёх цветов. Работает в светлой (default)
 *  и тёмной (dark — для Focus Mode) темах. Задачи редактируются везде через этот компонент. */
export const PriorityDot: React.FC<{
  priority: number;
  onChange: (p: number) => void;
  tone?: 'light' | 'dark';
  size?: number;
  title?: string;
}> = ({ priority, onChange, tone = 'light', size = 12, title }) => {
  const [open, setOpen] = useState(false);
  const pop = tone === 'dark'
    ? 'bg-[#1c1b26] border-white/15'
    : 'bg-bg-card border-border';
  return (
    <span className="relative inline-flex shrink-0">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        className="rounded-full ring-2 ring-black/5 transition-transform hover:scale-125"
        style={{ background: PRIORITY_COLOR[priority] ?? PRIORITY_COLOR[3], width: size, height: size }}
        title={title ?? `Важность: ${PRIORITY_LABEL[priority] ?? '—'} — клик, чтобы изменить`}
      />
      {open && (
        <>
          {/* клик вне палитры закрывает её */}
          <span className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setOpen(false); }} />
          <span className={`absolute z-50 top-5 left-1/2 -translate-x-1/2 flex gap-1.5 p-1.5 rounded-xl border shadow-xl ${pop}`}>
            {[1, 2, 3].map((p) => (
              <button
                key={p}
                onClick={(e) => { e.stopPropagation(); onChange(p); setOpen(false); }}
                className="h-5 w-5 rounded-full transition-transform hover:scale-110"
                style={{ background: PRIORITY_COLOR[p], boxShadow: p === priority ? '0 0 0 2px #fff, 0 0 0 3px rgba(0,0,0,.25)' : 'none' }}
                title={PRIORITY_LABEL[p]}
              />
            ))}
          </span>
        </>
      )}
    </span>
  );
};
