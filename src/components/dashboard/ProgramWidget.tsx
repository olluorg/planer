import { useEffect, useMemo, useState } from 'react';
import { Dumbbell, Play, Flame, CalendarCheck } from 'lucide-react';
import {
  getProgress, currentDay, openProgram, openWorkoutHub, workoutStreak,
  PROGRAMS_EVENT, type InstalledProgram,
} from '@/lib/marketplace';
import { useStore } from '@/lib/store';

/** Дашборд-виджет купленной программы: прогресс/стрик на лице, клик → раздел (плеер/зал).
 *  Каждая установленная программа = отдельная плитка (id `program:<id>`). */
export const ProgramWidget: React.FC<{ program: InstalledProgram }> = ({ program }) => {
  const healthLogs = useStore((s) => s.healthLogs);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const on = () => setTick((t) => t + 1);
    window.addEventListener(PROGRAMS_EVENT, on);
    return () => window.removeEventListener(PROGRAMS_EVENT, on);
  }, []);

  const isHub = program.kind === 'hub';
  const streak = useMemo(() => workoutStreak(healthLogs), [healthLogs]);
  const prog = useMemo(() => {
    void tick;
    const p = getProgress(program.id);
    // total неизвестен без расшифровки — оцениваем по отмеченным + текущему дню; для полосы берём 56 как дефолт курса
    const total = 56;
    return { done: p.done.length, day: currentDay(program.id, total), total };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [program.id, tick]);

  const open = () => (isHub ? openWorkoutHub(program.id) : openProgram(program.id));
  const pct = isHub ? 0 : Math.min(100, Math.round((prog.done / prog.total) * 100));

  return (
    <div className="h-full overflow-hidden flex flex-col rounded-2xl bg-bg-card border border-border-soft p-4">
      <div className="flex items-center gap-3 shrink-0">
        <div className="h-11 w-11 rounded-xl bg-accent/12 text-2xl flex items-center justify-center shrink-0">{program.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-wider text-accent">{isHub ? 'Фитнес-зал' : 'Программа'}</div>
          <h3 className="text-sm font-semibold text-text leading-snug truncate">{program.title}</h3>
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col justify-center py-3">
        {isHub ? (
          <div className="flex items-center gap-3">
            <div className="relative h-16 w-16 flex items-center justify-center shrink-0">
              <Flame className={`h-16 w-16 ${streak > 0 ? 'text-orange-500/90' : 'text-text-dim/40'}`} strokeWidth={1.25} />
              <span className="absolute text-lg font-black text-text">{streak}</span>
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-text">Стрик тренировок</div>
              <div className="text-xs text-text-muted">{streak > 0 ? `${streak} дней подряд — держи!` : 'Начни сегодня'}</div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <span className="text-sm font-semibold text-text">День {prog.day} из {prog.total}</span>
              <span className="text-xs text-text-muted">{prog.done} пройдено · {pct}%</span>
            </div>
            <div className="h-2 rounded-full bg-bg-soft overflow-hidden">
              <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={open}
        className="shrink-0 w-full rounded-xl bg-accent text-white px-4 py-2.5 text-sm font-semibold inline-flex items-center justify-center gap-2 hover:opacity-90"
      >
        {isHub ? <Dumbbell className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {isHub ? 'Открыть зал' : 'Продолжить'}
      </button>

      {!isHub && (
        <div className="shrink-0 mt-2 flex items-center justify-center gap-1.5 text-[11px] text-text-dim">
          <CalendarCheck className="h-3 w-3" /> обновляется по дням
        </div>
      )}
    </div>
  );
};
