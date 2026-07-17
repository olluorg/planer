import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';

interface CelebrationDetail { title?: string; subtitle?: string; emoji?: string }

/** Крупный эмоциональный отклик на достижение: большой пульсирующий кружок с галочкой,
 *  заголовок, подпись. Держится ~2.6с, гасится кликом. Слушает `thedad:celebrate`. */
export const Celebration: React.FC = () => {
  const [data, setData] = useState<CelebrationDetail | null>(null);

  useEffect(() => {
    const onCelebrate = (e: Event) => {
      const detail = (e as CustomEvent<CelebrationDetail>).detail ?? {};
      setData(detail);
    };
    window.addEventListener('thedad:celebrate', onCelebrate);
    return () => window.removeEventListener('thedad:celebrate', onCelebrate);
  }, []);

  useEffect(() => {
    if (!data) return;
    const t = setTimeout(() => setData(null), 2600);
    return () => clearTimeout(t);
  }, [data]);

  if (!data) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center pointer-events-auto cursor-pointer"
      onClick={() => setData(null)}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fade-in_180ms_ease-out]" />
      <div className="relative flex flex-col items-center text-center px-8 animate-[celebrate-pop_360ms_cubic-bezier(0.22,1,0.36,1)]">
        {/* Пульсирующие кольца */}
        <div className="relative mb-5">
          <span className="absolute inset-0 rounded-full bg-emerald-400/30 animate-[celebrate-ring_1.4s_ease-out_infinite]" />
          <span className="absolute inset-0 rounded-full bg-emerald-400/20 animate-[celebrate-ring_1.4s_ease-out_0.4s_infinite]" />
          <div className="relative h-28 w-28 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-[0_12px_40px_rgba(16,185,129,0.5)]">
            {data.emoji
              ? <span className="text-5xl leading-none">{data.emoji}</span>
              : <Check className="h-14 w-14 text-white" strokeWidth={3} />}
          </div>
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-white drop-shadow">{data.title ?? 'Готово!'}</div>
        {data.subtitle && <div className="text-sm text-white/80 mt-1.5 max-w-xs">{data.subtitle}</div>}
      </div>
    </div>,
    document.body,
  );
};
