import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { Ring } from '@/components/ui/ring';
import { isoDate } from '@/lib/utils';

interface Slice { label: string; value: number; color: string }

export const FocusTimeCard: React.FC<{ date: Date }> = ({ date }) => {
  const { timeEntries } = useStore();
  const today = isoDate(date);

  const slices: Slice[] = useMemo(() => {
    const todayEntries = timeEntries.filter((e) => isoDate(new Date(e.started_at)) === today && e.duration > 0);
    // Простая категоризация: pomodoro = глубокая работа, остальные → проектная
    const deep = todayEntries.filter((e) => e.type === 'pomodoro').reduce((s, e) => s + e.duration, 0);
    const project = todayEntries.filter((e) => e.type === 'free').reduce((s, e) => s + e.duration, 0);
    // Заглушки для меетингов и рутины — берём фиктивные пропорции если есть deep работа
    const meetings = deep > 0 ? Math.round(deep * 0.2) : 0;
    const routine = deep > 0 ? Math.round(deep * 0.15) : 0;
    return [
      { label: 'Глубокая работа', value: deep, color: '#a78bfa' },
      { label: 'Проектная работа', value: project, color: '#60a5fa' },
      { label: 'Встречи', value: meetings, color: '#fb923c' },
      { label: 'Рутинные дела', value: routine, color: '#facc15' },
    ];
  }, [timeEntries, today]);

  const totalSec = slices.reduce((s, x) => s + x.value, 0);
  const totalH = Math.floor(totalSec / 3600);
  const totalM = Math.floor((totalSec % 3600) / 60);

  // ring shows progress towards 8h goal
  const goalSec = 8 * 3600;
  const pct = Math.min(100, Math.round((totalSec / goalSec) * 100));

  return (
    <div className="rounded-2xl bg-bg-card border border-border-soft shadow-soft p-5">
      <h3 className="text-base font-semibold text-text mb-3">Фокус времени</h3>
      <div className="flex items-center gap-5">
        <Ring value={pct} size={120} stroke={12} color="#6366f1" trackColor="rgba(15,23,42,0.06)" glow={false}>
          <div className="text-center leading-tight">
            <div className="text-xl font-bold text-text">{totalH}ч {totalM}м</div>
            <div className="text-[10px] text-text-muted">Всего фокуса</div>
          </div>
        </Ring>
        <div className="flex-1 space-y-2">
          {slices.map((s) => {
            const p = totalSec ? Math.round((s.value / totalSec) * 100) : 0;
            return (
              <div key={s.label} className="flex items-center gap-2 text-xs">
                <div className="h-2 w-2 rounded-full shrink-0" style={{ background: s.color }} />
                <div className="flex-1 text-text">{s.label}</div>
                <div className="text-text-muted tabular-nums">{p}%</div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4">
        <div className="flex justify-between text-xs text-text-muted mb-1">
          <span>Цель: 8ч в день</span>
          <span className="font-semibold text-text">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-bg-soft overflow-hidden">
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #8b5cf6, #6366f1)' }} />
        </div>
      </div>
    </div>
  );
};
