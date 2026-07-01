import { useStore } from '@/lib/store';
import { WidgetCard } from '@/components/ui/widget-card';
import { useNavigate } from 'react-router-dom';

export const GoalsProgress: React.FC = () => {
  const { goals } = useStore();
  const nav = useNavigate();
  const rootGoals = goals.filter((g) => !g.parent_id).slice(0, 5);

  return (
    <WidgetCard
      title="Прогресс целей"
      action={
        <button className="hover:text-accent transition-colors duration-base" onClick={() => nav('/goals')}>
          Все цели
        </button>
      }
    >
      <div className="space-y-3">
        {rootGoals.length === 0 && <div className="text-xs text-text-muted">Нет целей</div>}
        {rootGoals.map((g) => {
          const denom = g.target_value - g.start_value || 1;
          const r = Math.round(Math.max(0, Math.min(1, (g.current_value - g.start_value) / denom)) * 100);
          return (
            <div key={g.id}>
              <div className="flex justify-between text-sm mb-1.5">
                <span className="text-text truncate pr-3">{g.title}</span>
                <span className="text-text font-semibold tabular-nums">{r}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-bg-soft overflow-hidden">
                <div
                  className="h-full rounded-full progress-bar"
                  style={{
                    width: `${r}%`,
                    background: 'linear-gradient(90deg, var(--accent-soft), var(--accent))',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </WidgetCard>
  );
};
