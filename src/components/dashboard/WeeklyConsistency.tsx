import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { addDays, startOfWeek, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Flame, Trophy, CheckCircle2 } from 'lucide-react';

const WD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const WEEKS = 8;

// Indigo-шкала Low → High (единый акцент)
const LEVELS = ['#e0e7ff', '#a5b4fc', '#818cf8', '#6366f1', '#4338ca'];

function levelColor(ratio: number): string {
  if (ratio < 0) return 'var(--bg-soft)';
  if (ratio === 0) return LEVELS[0];
  if (ratio < 0.34) return LEVELS[1];
  if (ratio < 0.67) return LEVELS[2];
  if (ratio < 1) return LEVELS[3];
  return LEVELS[4];
}

export const WeeklyConsistency: React.FC = () => {
  const nav = useNavigate();
  const { tasks } = useStore();
  const todayIso = isoDate(new Date());

  const rows = useMemo(() => {
    const thisWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const firstWeekStart = addDays(thisWeekStart, -7 * (WEEKS - 1));
    return Array.from({ length: WEEKS }, (_, w) => {
      const weekStart = addDays(firstWeekStart, w * 7);
      const cells = Array.from({ length: 7 }, (_, d) => {
        const date = isoDate(addDays(weekStart, d));
        const future = date > todayIso;
        const dt = tasks.filter((t) => t.date === date && !t.parent_id);
        const ratio = future ? -2 : dt.length ? dt.filter((t) => t.status === 'done').length / dt.length : -1;
        return { date, ratio, total: dt.length, done: dt.filter((t) => t.status === 'done').length, future };
      });
      return { weekStart, cells };
    });
  }, [tasks, todayIso]);

  const stats = useMemo(() => {
    const flat = rows.flatMap((r) => r.cells).filter((c) => !c.future);
    const activeDays = flat.filter((c) => c.ratio > 0).length;
    const totalDays = flat.length || 1;

    // текущая серия активных дней
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = isoDate(addDays(new Date(), -i));
      const dt = tasks.filter((t) => t.date === d && !t.parent_id && t.status === 'done');
      if (dt.length > 0) streak++;
      else if (i > 0) break;
    }

    // лучший день недели по средней доле
    const byWeekday = WD.map((_, idx) => {
      const cells = rows.map((r) => r.cells[idx]).filter((c) => !c.future && c.ratio >= 0);
      const avg = cells.length ? cells.reduce((s, c) => s + c.ratio, 0) / cells.length : 0;
      return { idx, avg };
    });
    const best = byWeekday.reduce((a, b) => (b.avg > a.avg ? b : a), byWeekday[0]);

    const totalDone = flat.reduce((s, c) => s + c.done, 0);

    return {
      activePct: Math.round((activeDays / totalDays) * 100),
      streak,
      bestDay: best.avg > 0 ? WD[best.idx] : '—',
      totalDone,
    };
  }, [rows, tasks]);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5 flex flex-col" style={{ containerType: 'inline-size' }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-base font-semibold text-text">Постоянство</h3>
        <button onClick={() => nav('/analytics')} className="hm-more text-xs text-accent hover:underline">Подробнее</button>
      </div>
      <div className="text-[11px] text-text-muted mb-4">{stats.activePct}% активных дней за {WEEKS} недель</div>

      {/* Крупная сетка во всю ширину */}
      <div className="grid gap-1 mx-auto w-full" style={{ gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', maxWidth: '300px' }}>
        {WD.map((d) => (
          <div key={d} className="text-[10px] text-text-dim text-center font-medium pb-1">{d}</div>
        ))}
        {rows.map((row) =>
          row.cells.map((c, di) => (
            <div
              key={`${row.weekStart.toISOString()}-${di}`}
              className="aspect-square w-full rounded-[5px] transition-all hover:ring-2 hover:ring-accent/40"
              style={
                c.future
                  ? { border: '1px dashed var(--border)' }
                  : { background: levelColor(c.ratio), boxShadow: 'inset 0 0 0 1px var(--border-soft)' }
              }
              title={c.future ? format(new Date(c.date), 'd MMM', { locale: ru }) : `${format(new Date(c.date), 'd MMM', { locale: ru })} · ${c.total ? `${c.done}/${c.total}` : 'нет задач'}`}
            />
          )),
        )}
      </div>

      {/* Легенда — непрерывный градиент */}
      <div className="hm-legend flex items-center justify-end gap-2 mt-3 text-[10px] text-text-muted">
        <span>меньше</span>
        <div
          className="h-2 w-24 rounded-full"
          style={{ background: `linear-gradient(90deg, ${LEVELS.join(', ')})` }}
        />
        <span>больше</span>
      </div>

      {/* Мини-статистика */}
      <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border-soft">
        <Stat icon={<Flame className="h-4 w-4 text-warning" />} value={`${stats.streak}`} label="серия дней" />
        <Stat icon={<Trophy className="h-4 w-4 text-accent" />} value={stats.bestDay} label="лучший день" />
        <Stat icon={<CheckCircle2 className="h-4 w-4 text-success" />} value={`${stats.totalDone}`} label="выполнено" />
      </div>
    </div>
  );
};

const Stat: React.FC<{ icon: React.ReactNode; value: string; label: string }> = ({ icon, value, label }) => (
  <div className="flex flex-col items-center gap-1 text-center">
    {icon}
    <div className="text-sm font-bold text-text tabular-nums leading-none">{value}</div>
    <div className="text-[10px] text-text-muted leading-none">{label}</div>
  </div>
);
