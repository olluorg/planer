import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { addDays, startOfWeek } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Check, Droplet, Dumbbell, BookOpen, Brain, Moon, Sparkles, ChevronDown } from 'lucide-react';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#06b6d4', '#ec4899'];

// Подбор иконки по ключевым словам в названии
function habitIcon(title: string): React.ElementType {
  const t = title.toLowerCase();
  if (/(вод|пить|water)/.test(t)) return Droplet;
  if (/(трен|спорт|зал|отжим|workout|зарядк)/.test(t)) return Dumbbell;
  if (/(чита|книг|read|страниц)/.test(t)) return BookOpen;
  if (/(медит|осознан|meditat)/.test(t)) return Brain;
  if (/(сон|спать|sleep|экран)/.test(t)) return Moon;
  return Sparkles;
}

const LIMIT = 8;

export const HabitDots: React.FC<{ date: Date }> = ({ date }) => {
  const { habits, habitLogs, toggleHabitLog } = useStore();
  const nav = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const ws = useMemo(() => startOfWeek(date, { weekStartsOn: 1 }), [date]);
  const weekDates = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDate(addDays(ws, i))), [ws]);
  const todayIso = isoDate(date);

  const shown = showAll ? habits : habits.slice(0, LIMIT);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text">Привычки</h3>
        <Button variant="ghost" size="sm" onClick={() => nav('/habits')}>Изменить</Button>
      </div>
      <div className="space-y-2.5">
        {habits.length === 0 && <div className="text-xs text-text-muted">Нет привычек</div>}
        {shown.map((h, i) => {
          const color = h.color ?? COLORS[i % COLORS.length];
          const Icon = habitIcon(h.title);
          const marks = weekDates.map((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d));
          const done = marks.filter(Boolean).length;
          return (
            <div key={h.id} className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}1f` }}>
                <Icon className="h-3.5 w-3.5" style={{ color }} />
              </div>
              <div className="flex-1 min-w-0 text-sm text-text truncate">{h.title}</div>
              <div className="flex gap-[3px] shrink-0">
                {marks.map((m, j) => {
                  const future = weekDates[j] > todayIso;
                  return (
                    <button
                      key={j}
                      onClick={() => !future && toggleHabitLog(h.id, weekDates[j])}
                      disabled={future}
                      className="h-4 w-4 rounded-full border flex items-center justify-center transition-all hover:scale-110 disabled:opacity-40"
                      style={{
                        background: m ? color : 'var(--bg-soft)',
                        borderColor: m ? color : 'var(--border)',
                      }}
                      title={weekDates[j]}
                    >
                      {m && <Check className="h-2 w-2 text-white" strokeWidth={3} />}
                    </button>
                  );
                })}
              </div>
              <div className="text-[11px] font-medium tabular-nums w-7 text-right shrink-0" style={{ color: done >= 5 ? color : 'var(--text-muted)' }}>
                {done}/7
              </div>
            </div>
          );
        })}
      </div>
      {habits.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-3 w-full flex items-center justify-center gap-1 text-xs text-text-muted hover:text-text"
        >
          {showAll ? 'Свернуть' : `Ещё ${habits.length - LIMIT}`}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
        </button>
      )}
    </div>
  );
};
