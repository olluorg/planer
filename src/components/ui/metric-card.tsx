import { Sparkline } from './sparkline';
import { useCountUp } from '@/lib/useCountUp';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface Props {
  label: string;
  value: number;
  suffix?: string;          // %, дн., ч и т.д.
  decimals?: number;
  delta?: number | null;    // изменение в % к прошлому периоду
  data?: number[];          // данные для спарклайна
  color?: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

export const MetricCard: React.FC<Props> = ({
  label, value, suffix = '', decimals = 0, delta, data, color = 'var(--accent)', icon, onClick,
}) => {
  const animated = useCountUp(value);
  const display = animated.toLocaleString('ru-RU', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  const deltaTone = delta == null ? '' : delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-text-muted';
  const DeltaIcon = delta == null ? Minus : delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="text-left rounded-xl bg-bg-card border border-border shadow-card p-5 transition-all hover:shadow-lift hover:-translate-y-0.5 disabled:cursor-default w-full"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="text-label text-text-muted">{label}</div>
        {icon && <div className="text-text-muted">{icon}</div>}
      </div>
      <div className="flex items-end justify-between gap-2">
        <div>
          <div className="text-h2 tabular-nums text-text leading-none">
            {display}{suffix}
          </div>
          {delta != null && (
            <div className={`flex items-center gap-1 text-caption mt-1.5 ${deltaTone}`}>
              <DeltaIcon className="h-3 w-3" />
              <span className="tabular-nums">{delta > 0 ? '+' : ''}{delta}%</span>
            </div>
          )}
        </div>
        {data && data.length > 1 && (
          <Sparkline data={data} color={color} width={84} height={36} />
        )}
      </div>
    </button>
  );
};
