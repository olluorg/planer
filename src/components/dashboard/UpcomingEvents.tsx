import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { format, differenceInCalendarDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Target, CheckSquare, Flag } from 'lucide-react';

interface Item {
  id: string;
  title: string;
  date: string;
  kind: 'goal' | 'task';
}

export const UpcomingEvents: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { goals, tasks } = useStore();
  const today = isoDate(date);

  const items = useMemo<Item[]>(() => {
    const goalItems: Item[] = goals
      .filter((g) => !g.parent_id && g.deadline && g.deadline >= today && g.status === 'active')
      .map((g) => ({ id: `g-${g.id}`, title: g.title, date: g.deadline!, kind: 'goal' }));
    const taskItems: Item[] = tasks
      .filter((t) => !t.parent_id && t.status === 'active' && t.date > today)
      .map((t) => ({ id: `t-${t.id}`, title: t.title, date: t.date, kind: 'task' }));
    return [...goalItems, ...taskItems].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  }, [goals, tasks, today]);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text">Ближайшее</h3>
        <button onClick={() => nav('/calendar')} className="text-xs text-accent hover:underline">Календарь</button>
      </div>
      {items.length === 0 ? (
        <div className="text-xs text-text-muted py-2">Нет предстоящих дедлайнов</div>
      ) : (
        <div className="space-y-2.5">
          {items.map((it) => {
            const days = differenceInCalendarDays(new Date(it.date), date);
            const Icon = it.kind === 'goal' ? Target : CheckSquare;
            return (
              <button
                key={it.id}
                onClick={() => nav(it.kind === 'goal' ? '/goals' : '/tasks')}
                className="w-full flex items-center gap-3 text-left group"
              >
                <div className="h-8 w-8 rounded-lg bg-bg-soft flex items-center justify-center shrink-0 group-hover:bg-accent/10 transition-colors">
                  <Icon className="h-4 w-4 text-text-muted group-hover:text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-text truncate">{it.title}</div>
                  <div className="text-[11px] text-text-muted">{format(new Date(it.date), 'd MMM', { locale: ru })}</div>
                </div>
                <span className={`text-[11px] tabular-nums shrink-0 ${days <= 1 ? 'text-danger' : days <= 3 ? 'text-warning' : 'text-text-muted'}`}>
                  {days === 0 ? 'сегодня' : days === 1 ? 'завтра' : `${days} дн.`}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
