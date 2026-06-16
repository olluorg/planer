import { useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { computeInsights, type InsightTone } from '@/lib/insights';
import { X, Lightbulb } from 'lucide-react';

const TONE_STYLE: Record<InsightTone, { bg: string; bar: string }> = {
  positive: { bg: 'rgba(34,197,94,0.08)', bar: '#22c55e' },
  warning:  { bg: 'rgba(239,68,68,0.08)', bar: '#ef4444' },
  neutral:  { bg: 'rgba(100,116,139,0.08)', bar: '#94a3b8' },
  info:     { bg: 'rgba(99,102,241,0.08)', bar: '#6366f1' },
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export const InsightsPanel: React.FC<Props> = ({ open, onClose }) => {
  const nav = useNavigate();
  const { tasks, habits, habitLogs, reflections, timeEntries, goals, progress } = useStore();
  const ref = useRef<HTMLDivElement>(null);

  const insights = useMemo(
    () => computeInsights({ today: new Date(), tasks, habits, habitLogs, reflections, timeEntries, goals, progress }),
    [tasks, habits, habitLogs, reflections, timeEntries, goals, progress],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[150] bg-black/30 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={ref}
        className="fixed right-0 top-0 bottom-0 z-[160] w-full sm:w-96 bg-bg-card border-l border-border-soft shadow-card flex flex-col"
        style={{ animation: 'slide-in-right 280ms cubic-bezier(0.32,0.72,0,1)' }}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-soft">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-accent/10 flex items-center justify-center">
              <Lightbulb className="h-4 w-4 text-accent" />
            </div>
            <h3 className="text-sm font-semibold text-text">Инсайты</h3>
          </div>
          <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-bg-soft flex items-center justify-center text-text-muted">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {insights.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-3xl mb-2">🧭</div>
              <div className="text-sm text-text font-medium">Пока нет инсайтов</div>
              <div className="text-xs text-text-muted mt-1">Поработай несколько дней — появятся наблюдения о твоём ритме.</div>
            </div>
          ) : (
            insights.map((ins) => {
              const s = TONE_STYLE[ins.tone];
              return (
                <button
                  key={ins.id}
                  onClick={() => { if (ins.link) { nav(ins.link); onClose(); } }}
                  className="w-full text-left rounded-xl p-3 transition-all hover:shadow-soft"
                  style={{ background: s.bg, borderLeft: `3px solid ${s.bar}` }}
                >
                  <div className="flex items-start gap-2.5">
                    <span className="text-lg leading-none mt-0.5">{ins.icon}</span>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-text leading-snug">{ins.title}</div>
                      <div className="text-xs text-text-muted leading-relaxed mt-1">{ins.body}</div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-5 py-3 border-t border-border-soft text-[11px] text-text-muted">
          Наблюдения на основе твоих данных. Без серверов и AI.
        </div>
      </div>
    </>
  );
};
