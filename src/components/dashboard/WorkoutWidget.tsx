import { useEffect, useState } from 'react';
import { Dumbbell, Play, Check } from 'lucide-react';
import { WorkoutMode, EXERCISES, WORKOUT_DONE_KEY } from '@/components/WorkoutMode';
import { isoDate } from '@/lib/utils';

/** Мини-превью упражнения: круглая картинка с заглушкой. */
const RoundPreview: React.FC<{ img: string; size?: number }> = ({ img, size = 44 }) => {
  const [failed, setFailed] = useState(false);
  return failed ? (
    <div
      className="rounded-full bg-accent/10 border border-border-soft flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <Dumbbell className="h-4 w-4 text-accent/70" />
    </div>
  ) : (
    <img
      src={img.replace('/studio/', '/studio/thumbs/')}
      alt=""
      loading="lazy"
      className="rounded-xl object-contain bg-white border border-border-soft shrink-0"
      style={{ width: size, height: size }}
      onError={() => setFailed(true)}
    />
  );
};

/** Виджет «Зарядка 7 минут»: запуск полноэкранной зарядки, статус на сегодня. */
export const WorkoutWidget: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [doneToday, setDoneToday] = useState(() => localStorage.getItem(WORKOUT_DONE_KEY) === isoDate(new Date()));

  useEffect(() => {
    const sync = () => setDoneToday(localStorage.getItem(WORKOUT_DONE_KEY) === isoDate(new Date()));
    window.addEventListener('thedad:workout-done', sync);
    return () => window.removeEventListener('thedad:workout-done', sync);
  }, []);

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border-soft shadow-card p-4 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 shrink-0">
        <Dumbbell className="h-4 w-4 text-accent shrink-0" />
        <span className="text-sm font-semibold text-text truncate flex-1">Движение · 7 минут</span>
        {doneToday && (
          <span className="flex items-center gap-1 rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[10px] font-semibold">
            <Check className="h-3 w-3" /> сегодня
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-hidden flex flex-col items-center justify-center gap-3 py-2">
        {/* Стопка круглых превью упражнений — прячется, если по высоте тесно */}
        <div className="flex gap-1 shrink-0">
          {EXERCISES.slice(0, 5).map((e) => <RoundPreview key={e.img} img={e.img} />)}
          <div className="h-11 w-11 rounded-full bg-bg-soft border border-border-soft flex items-center justify-center text-[10px] font-semibold text-text-muted shrink-0">
            +{EXERCISES.length - 5}
          </div>
        </div>
        <div className="text-xs text-text-muted text-center leading-relaxed shrink-0">
          7 упражнений × 1 минута.<br />
          <span className="text-text-dim">Без прыжков, зарядка, калистеника и йога</span>
        </div>
      </div>

      <button
        onClick={() => setOpen(true)}
        className="shrink-0 w-full h-10 rounded-xl bg-accent text-white text-sm font-semibold flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.99] transition-[opacity,transform]"
      >
        <Play className="h-4 w-4" fill="currentColor" /> {doneToday ? 'Ещё разок' : 'Выбрать тренировку'}
      </button>

      <WorkoutMode open={open} onClose={() => setOpen(false)} />
    </div>
  );
};
