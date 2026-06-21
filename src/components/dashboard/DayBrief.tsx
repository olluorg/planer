import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { computeInsights } from '@/lib/insights';
import { Sparkles, ChevronRight } from 'lucide-react';

const TONE_DOT: Record<string, string> = {
  positive: '#22c55e', warning: '#ef4444', neutral: '#94a3b8', info: '#6366f1',
};

export const DayBrief: React.FC<{ date: Date }> = ({ date }) => {
  const nav = useNavigate();
  const { tasks, habits, habitLogs, reflections, timeEntries, goals, progress } = useStore();

  const insights = useMemo(
    () => computeInsights({ today: date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress }).slice(0, 3),
    [date, tasks, habits, habitLogs, reflections, timeEntries, goals, progress],
  );

  const headline = useMemo(() => {
    const todayIso = date.toISOString().slice(0, 10);
    const dt = tasks.filter((t) => t.date === todayIso && !t.parent_id);
    const ratio = dt.length ? dt.filter((t) => t.status === 'done').length / dt.length : 0;
    if (ratio >= 0.7) return 'Отличный темп — день под контролем.';
    if (ratio >= 0.3) return 'Хороший день, продолжай по плану.';
    return 'Высокий шанс выиграть день. Начни с главного.';
  }, [tasks, date]);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5 flex flex-col">
      <div className="flex items-center gap-1.5 text-label text-accent mb-3">
        <Sparkles className="h-3.5 w-3.5" /> Сводка дня
      </div>

      <div className="text-h3 text-text leading-snug mb-4">{headline}</div>

      <div className="space-y-3 flex-1">
        {insights.length === 0 ? (
          <div className="text-sm text-text-muted">Поработай несколько дней — появятся наблюдения о твоём ритме.</div>
        ) : (
          insights.map((ins) => (
            <button
              key={ins.id}
              onClick={() => ins.link && nav(ins.link)}
              className="w-full flex items-start gap-3 text-left group"
            >
              <span className="text-lg leading-none mt-0.5">{ins.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-text leading-snug">{ins.title}</div>
                <div className="text-xs text-text-muted leading-relaxed mt-0.5 line-clamp-2">{ins.body}</div>
              </div>
              <span className="h-1.5 w-1.5 rounded-full mt-2 shrink-0" style={{ background: TONE_DOT[ins.tone] }} />
            </button>
          ))
        )}
      </div>

      <button onClick={() => nav('/analytics')} className="mt-4 flex items-center gap-1 text-sm text-accent hover:underline">
        Полный анализ <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};
