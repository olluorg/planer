import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { Check, Plus } from 'lucide-react';

const BLOCK_DOT: Record<string, string> = {
  morning: '#facc15', day: '#60a5fa', evening: '#fb923c', night: '#a78bfa',
};

export const TodayPlanList: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { tasks, toggleTask } = useStore();
  const today = isoDate(date);

  const list = useMemo(() => {
    return tasks
      .filter((t) => t.date === today && !t.parent_id)
      .sort((a, b) => {
        // активные сверху, потом по времени
        if ((a.status === 'done') !== (b.status === 'done')) return a.status === 'done' ? 1 : -1;
        return (a.start_time ?? '99:99').localeCompare(b.start_time ?? '99:99');
      });
  }, [tasks, today]);

  const done = list.filter((t) => t.status === 'done').length;

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text">Сегодняшний план</h3>
        <span className="text-xs text-text-muted tabular-nums">{done}/{list.length}</span>
      </div>

      <div className="flex-1 space-y-0.5 -mx-2 overflow-y-auto max-h-[420px]">
        {list.length === 0 && <div className="text-xs text-text-muted px-2 py-4">Нет задач на сегодня</div>}
        {list.map((t) => (
          <label
            key={t.id}
            className="flex items-center gap-2.5 px-2 py-2 rounded-lg cursor-pointer hover:bg-bg-soft transition-colors"
          >
            <button
              onClick={() => toggleTask(t.id)}
              className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                t.status === 'done' ? 'border-accent bg-accent text-white' : 'border-border'
              }`}
            >
              {t.status === 'done' && <Check className="h-3 w-3" strokeWidth={3} />}
            </button>
            <span className={`flex-1 text-sm truncate ${t.status === 'done' ? 'line-through text-text-muted' : 'text-text'}`}>
              {t.title}
            </span>
            {t.priority === 1 && t.status !== 'done' && (
              <span className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-danger/10 text-danger shrink-0">важно</span>
            )}
            {t.time_block && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: BLOCK_DOT[t.time_block] }} title={t.time_block} />}
            {t.start_time && <span className="text-xs text-text-muted tabular-nums shrink-0 w-10 text-right">{t.start_time}</span>}
          </label>
        ))}
      </div>

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('thedad:quick-capture'))}
        className="mt-2 flex items-center justify-center gap-1.5 text-xs text-text-muted hover:text-accent py-2 rounded-lg hover:bg-bg-soft transition-colors"
      >
        <Plus className="h-3.5 w-3.5" /> Добавить задачу
      </button>
    </div>
  );
};
