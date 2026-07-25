import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { safePhoto, type WorkoutHub, type WorkoutSession } from '@/lib/marketplace';

const TYPE_COLORS: Record<string, string> = {
  strength: '#ef4444', cardio: '#22c55e', yoga: '#a78bfa',
  calisthenics: '#f59e0b', mobility: '#38bdf8', rest: '#64748b',
};
const typeColor = (t: string) => TYPE_COLORS[t.trim().toLowerCase()] ?? '#8b5cf6';

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const WEEK = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const iso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

/** Календарь тренировок: выполненные (из healthLogs) + запланированные (недельное расписание хаба). */
export const WorkoutCalendar: React.FC<{
  hub: WorkoutHub;
  completedDays: Set<string>;
  onOpenSession: (s: WorkoutSession) => void;
}> = ({ hub, completedDays, onOpenSession }) => {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState<string | null>(null);

  const todayISO = iso(now.getFullYear(), now.getMonth(), now.getDate());
  const sessionById = (id: string) => hub.sessions.find((s) => s.id === id);
  const weekdaySessions = (mondayIdx: number): WorkoutSession[] =>
    (hub.schedule?.[mondayIdx]?.sessions ?? []).map(sessionById).filter((s): s is WorkoutSession => !!s);

  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const startPad = (first.getDay() + 6) % 7; // Пн=0
    const daysIn = new Date(year, month + 1, 0).getDate();
    const arr: ({ day: number; date: string; mondayIdx: number } | null)[] = [];
    for (let i = 0; i < startPad; i++) arr.push(null);
    for (let d = 1; d <= daysIn; d++) {
      const date = new Date(year, month, d);
      arr.push({ day: d, date: iso(year, month, d), mondayIdx: (date.getDay() + 6) % 7 });
    }
    return arr;
  }, [year, month]);

  const prev = () => { setSelected(null); if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const next = () => { setSelected(null); if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };

  const selSessions = selected ? weekdaySessions((new Date(selected).getDay() + 6) % 7) : [];
  const selDone = selected ? completedDays.has(selected) : false;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="text-[11px] uppercase tracking-widest font-semibold text-text-muted">{MONTHS[month]} {year}</div>
        <div className="flex gap-1">
          <button onClick={prev} className="h-7 w-7 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted"><ChevronLeft className="h-4 w-4" /></button>
          <button onClick={next} className="h-7 w-7 rounded-lg bg-bg-soft hover:bg-bg-hover flex items-center justify-center text-text-muted"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEK.map((w) => <div key={w} className="text-center text-[10px] text-text-dim uppercase pb-1">{w}</div>)}
        {cells.map((c, i) => {
          if (!c) return <div key={i} />;
          const planned = weekdaySessions(c.mondayIdx);
          const done = completedDays.has(c.date);
          const isToday = c.date === todayISO;
          const isSel = c.date === selected;
          return (
            <button
              key={i}
              onClick={() => setSelected(isSel ? null : c.date)}
              className={`aspect-square rounded-lg border p-1 flex flex-col items-center justify-start text-[12px] transition-colors ${
                isSel ? 'border-accent bg-accent/10' : isToday ? 'border-accent/50 bg-bg-card' : 'border-border-soft bg-bg-card hover:bg-bg-hover'
              }`}
            >
              <span className={`leading-none mt-0.5 ${isToday ? 'font-bold text-accent' : 'text-text'}`}>{c.day}</span>
              <div className="flex-1 flex items-center justify-center gap-0.5 flex-wrap">
                {done
                  ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                  : planned.slice(0, 3).map((s, k) => <span key={k} className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: typeColor(s.type) }} />)}
              </div>
            </button>
          );
        })}
      </div>

      {/* Панель выбранного дня */}
      {selected && (
        <div className="mt-3 rounded-xl border border-border-soft bg-bg-card p-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[13px] font-semibold text-text">{new Date(selected).getDate()} {MONTHS[new Date(selected).getMonth()].toLowerCase()}</span>
            {selDone && <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-500 px-2 py-0.5 text-[10px] font-medium"><Check className="h-3 w-3" /> выполнено</span>}
          </div>
          {selSessions.length === 0 ? (
            <div className="text-[12px] text-text-dim">Тренировок не запланировано — день отдыха.</div>
          ) : (
            <div className="space-y-1.5">
              {selSessions.map((s) => {
                const photo = safePhoto(s.photo);
                return (
                  <button key={s.id} onClick={() => onOpenSession(s)} className="flex items-center gap-2.5 w-full text-left rounded-lg hover:bg-bg-hover p-1.5">
                    <div className="h-8 w-8 rounded-md bg-bg-soft overflow-hidden shrink-0 flex items-center justify-center text-sm" style={{ borderLeft: `2px solid ${typeColor(s.type)}` }}>
                      {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : '🏋️'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] text-text truncate">{s.title}</div>
                      <div className="text-[11px] text-text-muted">{s.type} · {s.duration}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
