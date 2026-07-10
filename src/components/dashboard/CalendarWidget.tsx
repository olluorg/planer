import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { startOfMonth, startOfWeek, addDays, format, isSameMonth } from 'date-fns';
import { ru } from 'date-fns/locale';

/** Компактный месяц на дашборде: сегодня выделен, точка на днях с активными задачами.
 *  Раскрывается в полную страницу «Календарь» через общий ⤢ виджета. */
export const CalendarWidget: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks } = useStore();
  const today = isoDate(new Date());

  const grid = useMemo(() => {
    const gStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(gStart, i));
  }, [date]);

  const taskDays = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => { if (t.status === 'active' && !t.parent_id) s.add(t.date); });
    return s;
  }, [tasks]);

  return (
    <div className="h-full flex flex-col rounded-xl bg-bg-card border border-border shadow-card p-4 overflow-hidden">
      <div className="text-label text-text capitalize mb-2.5 shrink-0">{format(date, 'LLLL yyyy', { locale: ru })}</div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-text-dim mb-1 shrink-0">
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => <div key={d} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 grid-rows-6 gap-0.5 flex-1 min-h-0">
        {grid.map((d, i) => {
          const iso = isoDate(d);
          const inMonth = isSameMonth(d, date);
          const isToday = iso === today;
          const has = taskDays.has(iso);
          return (
            <div
              key={i}
              className={`relative flex items-center justify-center rounded-md text-[11px] tabular-nums transition-colors ${
                isToday ? 'bg-accent text-white font-semibold' : inMonth ? 'text-text' : 'text-text-dim/60'
              }`}
            >
              {d.getDate()}
              {has && !isToday && <span className="absolute bottom-[3px] h-1 w-1 rounded-full bg-accent" />}
            </div>
          );
        })}
      </div>
    </div>
  );
};
