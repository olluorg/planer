import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { addDays, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const COLORS = ['#a78bfa', '#34d399', '#facc15', '#22c55e', '#fb923c'];

export const HabitDots: React.FC<{ date: Date }> = ({ date }) => {
  const { habits, habitLogs, toggleHabitLog } = useStore();
  const nav = useNavigate();
  const ws = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(addDays(ws, i))), [ws]);

  return (
    <div className="rounded-2xl bg-bg-card border border-border-soft shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text">Привычки</h3>
        <Button variant="ghost" size="sm" onClick={() => nav('/habits')}>Изменить</Button>
      </div>
      <div className="space-y-3">
        {habits.length === 0 && <div className="text-xs text-text-muted">Нет привычек</div>}
        {habits.map((h, i) => {
          const color = h.color ?? COLORS[i % COLORS.length];
          const marks = weekDates.map((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d));
          const done = marks.filter(Boolean).length;
          return (
            <div key={h.id} className="flex items-center gap-3">
              <div className="flex-1 text-sm text-text truncate">{h.title}</div>
              <div className="flex gap-1.5">
                {marks.map((m, j) => (
                  <button
                    key={j}
                    onClick={() => toggleHabitLog(h.id, weekDates[j])}
                    className="h-3.5 w-3.5 rounded-full transition-all hover:scale-125"
                    style={{ background: m ? color : 'rgba(15,23,42,0.08)' }}
                    title={weekDates[j]}
                  />
                ))}
              </div>
              <div className="text-[11px] text-text-muted tabular-nums w-8 text-right">
                {done}/7
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
