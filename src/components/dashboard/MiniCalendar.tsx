import { useMemo } from 'react';
import { format, getDaysInMonth, startOfMonth, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props { date: Date; onDateChange: (d: Date) => void }

export const MiniCalendar: React.FC<Props> = ({ date, onDateChange }) => {
  const monthInfo = useMemo(() => {
    const start = startOfMonth(date);
    const startDow = (start.getDay() + 6) % 7; // 0=Mon
    const days = getDaysInMonth(date);
    // grid: 6 rows × 7 cols, leading cells from prev month
    const cells: { day: number; isCurrent: boolean; date: Date }[] = [];
    for (let i = 0; i < startDow; i++) {
      const d = addDays(start, -(startDow - i));
      cells.push({ day: d.getDate(), isCurrent: false, date: d });
    }
    for (let i = 0; i < days; i++) {
      const d = addDays(start, i);
      cells.push({ day: d.getDate(), isCurrent: true, date: d });
    }
    while (cells.length < 42) {
      const last = cells[cells.length - 1].date;
      const d = addDays(last, 1);
      cells.push({ day: d.getDate(), isCurrent: false, date: d });
    }
    return cells;
  }, [date]);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-text">Календарь</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { const d = new Date(date); d.setMonth(d.getMonth() - 1); onDateChange(d); }}
            className="h-7 w-7 rounded-lg hover:bg-bg-soft flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4 text-text-muted" />
          </button>
          <div className="text-sm font-semibold capitalize w-28 text-center">{format(date, 'LLLL yyyy', { locale: ru })}</div>
          <button
            onClick={() => { const d = new Date(date); d.setMonth(d.getMonth() + 1); onDateChange(d); }}
            className="h-7 w-7 rounded-lg hover:bg-bg-soft flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4 text-text-muted" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => (
          <div key={d} className="text-[10px] text-text-muted text-center font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {monthInfo.map((c, i) => {
          const isToday = c.date.toDateString() === date.toDateString();
          return (
            <button
              key={i}
              onClick={() => onDateChange(c.date)}
              className={`h-8 w-full rounded-lg text-xs font-medium transition-all ${
                isToday
                  ? 'bg-accent text-white shadow-lift'
                  : c.isCurrent
                  ? 'text-text hover:bg-bg-soft'
                  : 'text-text-dim hover:bg-bg-soft'
              }`}
            >
              {c.day}
            </button>
          );
        })}
      </div>
    </div>
  );
};
