import { useStore } from '@/lib/store';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export const GoalsProgress: React.FC = () => {
  const { goals } = useStore();
  const nav = useNavigate();
  const rootGoals = goals.filter((g) => !g.parent_id).slice(0, 5);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text">Прогресс целей</h3>
        <Button variant="ghost" size="sm" onClick={() => nav('/goals')}>Все цели</Button>
      </div>
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
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${r}%`,
                    background: 'linear-gradient(90deg, #8b5cf6, #6366f1)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
