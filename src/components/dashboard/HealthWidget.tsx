import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Scale, Moon, Footprints, Droplet, Dumbbell, Zap, HeartPulse } from 'lucide-react';
import { Ring } from '@/components/ui/ring';
import { useStore } from '@/lib/store';
import { isoDate, fmtNum } from '@/lib/utils';
import type { HealthMetric } from '@/lib/types';

const METRICS: { key: HealthMetric; label: string; unit: string; icon: React.ElementType; color: string; goal: number | null; decimals: number }[] = [
  { key: 'sleep',   label: 'Сон',        unit: 'ч',   icon: Moon,       color: '#8b5cf6', goal: 8,     decimals: 1 },
  { key: 'steps',   label: 'Шаги',       unit: '',    icon: Footprints, color: '#22c55e', goal: 10000, decimals: 0 },
  { key: 'water',   label: 'Вода',       unit: 'л',   icon: Droplet,    color: '#06b6d4', goal: 2,     decimals: 1 },
  { key: 'workout', label: 'Трен.',      unit: 'мин', icon: Dumbbell,   color: '#f59e0b', goal: 30,    decimals: 0 },
  { key: 'energy',  label: 'Энергия',    unit: '/10', icon: Zap,        color: '#ec4899', goal: 7,     decimals: 0 },
  { key: 'weight',  label: 'Вес',        unit: 'кг',  icon: Scale,      color: '#6366f1', goal: null,  decimals: 1 },
];

export const HealthWidget: React.FC<{ date: Date }> = ({ date }) => {
  const { healthLogs } = useStore();
  const nav = useNavigate();
  const d = isoDate(date);

  const valueOf = (metric: HealthMetric) => healthLogs.find((l) => l.date === d && l.metric === metric)?.value ?? null;

  const score = useMemo(() => {
    const parts = METRICS.filter((m) => m.goal != null).map((m) => {
      const v = valueOf(m.key);
      return v == null ? null : Math.max(0, Math.min(1, v / m.goal!));
    }).filter((x): x is number => x != null);
    return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null;
  }, [healthLogs, d]);

  const logged = METRICS.filter((m) => valueOf(m.key) != null);

  return (
    <div className="h-full rounded-xl bg-bg-card border border-border shadow-card p-5 flex flex-col">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <h3 className="text-base font-semibold text-text flex items-center gap-2"><HeartPulse className="h-4 w-4 text-accent" /> Здоровье</h3>
        <button onClick={() => nav('/health')} className="text-xs text-accent hover:underline">Открыть</button>
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <Ring value={score ?? 0} size={72} stroke={8} color={score == null ? 'var(--border)' : score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'} glow={false} trackColor="var(--border)">
          <div className="text-sm font-bold tabular-nums">{score == null ? '—' : `${score}%`}</div>
        </Ring>
        <div className="text-small text-text-muted leading-snug">
          {score == null ? 'Залогируй метрики на странице «Здоровье»' : score >= 70 ? 'Отличный день для тела' : score >= 40 ? 'Норм, есть что добрать' : 'Тело просит внимания'}
        </div>
      </div>
      <div className="mt-4 pt-3 border-t border-border-soft grid grid-cols-2 gap-x-4 gap-y-2 flex-1 content-start">
        {logged.length === 0 && <div className="col-span-2 text-caption text-text-muted">Сегодня ещё нет записей</div>}
        {logged.map((m) => {
          const v = valueOf(m.key)!;
          return (
            <div key={m.key} className="flex items-center gap-2 text-small">
              <m.icon className="h-3.5 w-3.5 shrink-0" style={{ color: m.color }} />
              <span className="text-text-muted flex-1 truncate">{m.label}</span>
              <span className="tabular-nums text-text font-medium">{fmtNum(v, m.decimals)}{m.unit ? ` ${m.unit}` : ''}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
