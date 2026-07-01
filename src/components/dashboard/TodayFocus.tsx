import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { Ring } from '@/components/ui/ring';
import { Play, Pencil, Zap, Clock, ChevronRight } from 'lucide-react';

interface Props { date: Date; onStartFocus: () => void }

const BLOCK_LABEL: Record<string, string> = {
  morning: 'Утро', day: 'День', evening: 'Вечер', night: 'Ночь',
};

function endTime(start: string, min: number): string {
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + (m || 0) + min;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export const TodayFocus: React.FC<Props> = ({ date, onStartFocus }) => {
  const nav = useNavigate();
  const { tasks, goals } = useStore();
  const today = isoDate(date);

  const focusTask = useMemo(() => {
    const list = tasks.filter((t) => t.date === today && t.status === 'active' && !t.parent_id);
    list.sort((a, b) => (a.priority - b.priority) || (a.start_time ?? '').localeCompare(b.start_time ?? ''));
    return list[0] ?? null;
  }, [tasks, today]);

  const focusGoal = useMemo(
    () => (focusTask?.goal_id ? goals.find((g) => g.id === focusTask.goal_id) ?? null : null),
    [goals, focusTask],
  );

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

  const timeRange = focusTask?.start_time
    ? focusTask.estimate_min
      ? `${focusTask.start_time} – ${endTime(focusTask.start_time, focusTask.estimate_min)}`
      : focusTask.start_time
    : null;

  return (
    <div className="h-full flex flex-col rounded-xl bg-bg-card border border-border shadow-card p-5 overflow-hidden">
      {/* Заголовок + действие */}
      <div className="flex items-center justify-between shrink-0">
        <div className="text-label text-text-muted">Фокус дня</div>
        <button
          onClick={() => nav('/plan')}
          className="h-8 px-3 rounded-lg border border-border text-xs font-medium text-text hover:bg-bg-soft transition-colors duration-base"
        >
          Спланировать день
        </button>
      </div>

      {/* Тело: задача слева, ринг справа */}
      <div className="flex-1 min-h-0 flex items-center gap-6 mt-1">
        <div className="flex-1 min-w-0">
          {focusTask ? (
            <>
              <div className="flex items-center gap-2.5 mb-2">
                {timeRange && (
                  <span className="text-sm font-medium text-text tabular-nums">{timeRange}</span>
                )}
                <span className="px-2 py-0.5 rounded-full bg-accent/10 text-accent text-[10px] font-semibold uppercase tracking-wider">
                  Фокус-блок
                </span>
              </div>
              <div className="text-h2 text-text leading-tight line-clamp-2">{focusTask.title}</div>
              {focusGoal && (
                <div className="text-base text-text-muted mt-1 truncate">{focusGoal.title}</div>
              )}

              {/* Мета-чипы */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {focusTask.priority === 1 && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-accent/10 text-accent text-xs font-medium">
                    <Zap className="h-3 w-3" /> Высокий приоритет
                  </span>
                )}
                {focusTask.estimate_min && (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-bg-soft border border-border-soft text-xs font-medium text-text-muted">
                    <Clock className="h-3 w-3" /> {focusTask.estimate_min} мин
                  </span>
                )}
                {focusTask.time_block && (
                  <span className="inline-flex items-center px-2 py-1 rounded-lg bg-bg-soft border border-border-soft text-xs font-medium text-text-muted">
                    {BLOCK_LABEL[focusTask.time_block] ?? focusTask.time_block}
                  </span>
                )}
              </div>

              {/* CTA */}
              <div className="flex items-center gap-2.5 mt-5">
                <button
                  onClick={onStartFocus}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent text-white px-4 h-10 text-sm font-semibold hover:bg-accent-soft transition-colors duration-base"
                >
                  <Play className="h-4 w-4" fill="currentColor" /> Начать фокус
                </button>
                <button
                  onClick={() => nav('/plan')}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-card px-4 h-10 text-sm font-medium text-text hover:bg-bg-soft transition-colors duration-base"
                >
                  <Pencil className="h-4 w-4" /> Подготовить
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="text-h2 text-text leading-tight">Нет активных задач</div>
              <div className="text-sm text-text-muted mt-1">Добавь главное на сегодня, чтобы был фокус.</div>
              <div className="flex items-center gap-2.5 mt-5">
                <button
                  onClick={() => nav('/tasks')}
                  className="inline-flex items-center gap-2 rounded-lg bg-accent text-white px-4 h-10 text-sm font-semibold hover:bg-accent-soft transition-colors duration-base"
                >
                  Добавить задачу <ChevronRight className="h-4 w-4" />
                </button>
                <button
                  onClick={() => nav('/plan')}
                  className="inline-flex items-center gap-2 rounded-lg border border-border bg-bg-card px-4 h-10 text-sm font-medium text-text hover:bg-bg-soft transition-colors duration-base"
                >
                  <Pencil className="h-4 w-4" /> Спланировать
                </button>
              </div>
            </>
          )}
        </div>

        {/* Ринг прогресса целей */}
        <button onClick={() => nav('/goals')} className="shrink-0 hidden sm:block" title="Все цели">
          <Ring value={goalProgress} size={132} stroke={11} color="var(--accent)" trackColor="var(--accent-glow-sm)" glow={false}>
            <div className="text-center leading-tight">
              <div className="text-[10px] text-text-muted">Прогресс целей</div>
              <div className="text-[28px] font-bold text-text tabular-nums leading-9">{goalProgress}%</div>
              <div className="text-[10px] text-text-muted">план недели</div>
            </div>
          </Ring>
        </button>
      </div>

      {/* Далее по расписанию */}
      {upNext.length > 0 && (
        <div className="flex items-center gap-5 mt-4 pt-3.5 border-t border-border-soft shrink-0 overflow-hidden">
          <span className="text-label text-text-muted shrink-0">Далее</span>
          {upNext.map((t) => (
            <span key={t.id} className="flex items-center gap-2 min-w-0 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
              <span className="text-text font-medium truncate">{t.title}</span>
              {t.start_time && <span className="text-text-muted tabular-nums shrink-0">{t.start_time}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
