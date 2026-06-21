import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { Ring } from '@/components/ui/ring';
import { Play, Pencil, Clock, ChevronRight } from 'lucide-react';

interface Props { date: Date; onStartFocus: () => void }

export const TodayFocus: React.FC<Props> = ({ date, onStartFocus }) => {
  const nav = useNavigate();
  const { tasks, goals } = useStore();
  const today = isoDate(date);

  const focusTask = useMemo(() => {
    const list = tasks.filter((t) => t.date === today && t.status === 'active' && !t.parent_id);
    list.sort((a, b) => (a.priority - b.priority) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
    return list[0] ?? null;
  }, [tasks, today]);

  const upNext = useMemo(() => {
    return tasks
      .filter((t) => t.date === today && t.status === 'active' && !t.parent_id && t.id !== focusTask?.id && t.start_time)
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''))
      .slice(0, 2);
  }, [tasks, today, focusTask]);

  // Прогресс по целям (общий)
  const goalProgress = useMemo(() => {
    const roots = goals.filter((g) => !g.parent_id);
    if (!roots.length) return 0;
    const sum = roots.reduce((s, g) => {
      const denom = g.target_value - g.start_value || 1;
      return s + Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom));
    }, 0);
    return Math.round((sum / roots.length) * 100);
  }, [goals]);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="text-label text-text-muted">Фокус дня</div>
        <button onClick={() => nav('/plan')} className="text-xs text-accent hover:underline flex items-center gap-1">
          <Pencil className="h-3 w-3" /> Спланировать день
        </button>
      </div>

      <div className="flex items-center gap-5">
        <div className="flex-1 min-w-0">
          {focusTask ? (
            <>
              <div className="flex items-center gap-2 text-xs text-text-muted mb-1.5">
                {focusTask.start_time && (
                  <span className="flex items-center gap-1 tabular-nums"><Clock className="h-3 w-3" />{focusTask.start_time}</span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-semibold uppercase tracking-wider">
                  {focusTask.priority === 1 ? 'Высокий приоритет' : 'Фокус-блок'}
                </span>
              </div>
              <div className="text-h3 text-text leading-tight truncate">{focusTask.title}</div>
              {focusTask.estimate_min && (
                <div className="text-sm text-text-muted mt-0.5">~{focusTask.estimate_min} мин</div>
              )}
              <div className="flex items-center gap-2 mt-4">
                <button
                  onClick={onStartFocus}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent text-white px-4 h-9 text-sm font-medium hover:bg-accent-soft shadow-lift transition-colors"
                >
                  <Play className="h-4 w-4" fill="white" /> Начать фокус
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-h3 text-text leading-tight">Нет активных задач</div>
              <div className="text-sm text-text-muted mt-1">Добавь главное на сегодня, чтобы был фокус.</div>
              <button
                onClick={() => nav('/tasks')}
                className="inline-flex items-center gap-2 rounded-lg bg-accent text-white px-4 h-9 text-sm font-medium hover:bg-accent-soft shadow-lift transition-colors mt-4"
              >
                Добавить задачу <ChevronRight className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <button onClick={() => nav('/goals')} className="shrink-0 text-center">
          <Ring value={goalProgress} size={120} stroke={10} color="#6366f1" trackColor="rgba(99,102,241,0.12)" glow={false}>
            <div>
              <div className="text-2xl font-bold text-text tabular-nums">{goalProgress}%</div>
              <div className="text-[10px] text-text-muted">по целям</div>
            </div>
          </Ring>
        </button>
      </div>

      {upNext.length > 0 && (
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border-soft text-xs text-text-muted">
          <span className="text-label">Далее</span>
          {upNext.map((t) => (
            <span key={t.id} className="flex items-center gap-1.5 truncate">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" />
              <span className="text-text truncate">{t.title}</span>
              {t.start_time && <span className="tabular-nums">{t.start_time}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
