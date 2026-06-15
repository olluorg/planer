import type { Goal } from '@/lib/types';

interface Props {
  goal: Goal;
  nodes?: number;
  className?: string;
}

type Tone = 'ahead' | 'on' | 'behind' | 'neutral';

function paceTone(goal: Goal): Tone {
  if (!goal.deadline) return 'neutral';
  const created = Date.parse(goal.created_at);
  const deadline = Date.parse(goal.deadline);
  const now = Date.now();
  if (!isFinite(created) || !isFinite(deadline) || deadline <= created) return 'neutral';
  const timeFrac = Math.max(0, Math.min(1, (now - created) / (deadline - created)));
  const denom = goal.target_value - goal.start_value || 1;
  const valueFrac = Math.max(0, Math.min(1, (goal.current_value - goal.start_value) / denom));
  const diff = valueFrac - timeFrac;
  if (diff > 0.05) return 'ahead';
  if (diff < -0.1) return 'behind';
  return 'on';
}

const TONE_COLOR: Record<Tone, string> = {
  ahead: '#22c55e',
  on: '#eab308',
  behind: '#ef4444',
  neutral: 'var(--accent)',
};

export const GoalPath: React.FC<Props> = ({ goal, nodes = 10, className }) => {
  const denom = goal.target_value - goal.start_value || 1;
  const r = Math.max(0, Math.min(1, (goal.current_value - goal.start_value) / denom));
  const filled = Math.round(r * nodes);
  const tone = paceTone(goal);
  const color = TONE_COLOR[tone];

  return (
    <div className={`flex items-center gap-1 ${className ?? ''}`}>
      {Array.from({ length: nodes }).map((_, i) => {
        const isDone = i < filled;
        const isCurrent = i === filled;
        const title = `${Math.round(((i + 1) / nodes) * 100)}% · ${
          tone === 'ahead' ? 'опережаешь' : tone === 'behind' ? 'отстаёшь' : tone === 'on' ? 'идёшь по графику' : ''
        }`;
        return (
          <div key={i} className="flex items-center gap-1">
            <div
              className={`h-7 w-7 flex items-center justify-center text-[10px] font-bold transition-all border ${
                isCurrent ? 'animate-pulse-ok' : ''
              }`}
              style={{
                background: isDone ? color : 'transparent',
                color: isDone ? '#0a0a0a' : isCurrent ? color : 'var(--text-dim)',
                borderColor: isDone || isCurrent ? color : 'var(--border)',
              }}
              title={title}
            >
              {isDone ? '✓' : Math.round(((i + 1) / nodes) * (goal.target_value - goal.start_value) + goal.start_value)}
            </div>
            {i < nodes - 1 && (
              <div
                className="w-3 h-px transition-colors"
                style={{
                  background: i < filled - 1 || (i === filled - 1 && filled === nodes) ? color : 'var(--border)',
                }}
              />
            )}
          </div>
        );
      })}
      {tone !== 'neutral' && (
        <span
          className="ml-2 text-[10px] uppercase tracking-wider"
          style={{ color }}
        >
          {tone === 'ahead' ? 'опережаешь' : tone === 'behind' ? 'отстаёшь' : 'по графику'}
        </span>
      )}
    </div>
  );
};
