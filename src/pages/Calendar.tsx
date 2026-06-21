import { useMemo, useState } from 'react';
import {
  addDays, addMonths, addWeeks, format, isSameMonth, isSameDay,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, getHours, getMinutes,
} from 'date-fns';
import { ru } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { QuickAddDialog } from '@/components/QuickAddDialog';

type View = 'month' | 'week';

const BLOCK_COLOR: Record<string, string> = {
  morning: '#facc15',
  day:     '#60a5fa',
  evening: '#fb923c',
  night:   '#a78bfa',
};

export const CalendarPage = () => {
  const { tasks, toggleTask } = useStore();
  const [view, setView] = useState<View>('month');
  const [cursor, setCursor] = useState<Date>(new Date());
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDate, setQuickDate] = useState<Date>(new Date());

  const title = view === 'month'
    ? format(cursor, 'LLLL yyyy', { locale: ru })
    : `${format(startOfWeek(cursor, { weekStartsOn: 1 }), 'd MMM', { locale: ru })} – ${format(endOfWeek(cursor, { weekStartsOn: 1 }), 'd MMM yyyy', { locale: ru })}`;

  const goPrev = () => setCursor((c) => view === 'month' ? addMonths(c, -1) : addWeeks(c, -1));
  const goNext = () => setCursor((c) => view === 'month' ? addMonths(c, 1) : addWeeks(c, 1));
  const goToday = () => setCursor(new Date());

  const openQuick = (d: Date) => { setQuickDate(d); setQuickOpen(true); };

  return (
    <div className="page py-4 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text">Календарь</h1>
          <div className="text-sm text-text-muted capitalize">{title}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList>
              <TabsTrigger value="month">Месяц</TabsTrigger>
              <TabsTrigger value="week">Неделя</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-1 rounded-xl bg-bg-soft p-0.5">
            <button onClick={goPrev} className="h-8 w-8 rounded-lg hover:bg-bg-hover flex items-center justify-center">
              <ChevronLeft className="h-4 w-4 text-text-muted" />
            </button>
            <button onClick={goToday} className="px-3 h-8 rounded-lg text-xs font-medium hover:bg-bg-hover text-text">Сегодня</button>
            <button onClick={goNext} className="h-8 w-8 rounded-lg hover:bg-bg-hover flex items-center justify-center">
              <ChevronRight className="h-4 w-4 text-text-muted" />
            </button>
          </div>
          <Button onClick={() => openQuick(new Date())}><Plus /> Новая задача</Button>
        </div>
      </div>

      {view === 'month' ? (
        <MonthView cursor={cursor} tasks={tasks} onDayClick={(d) => { setCursor(d); setView('week'); }} onDayAdd={openQuick} />
      ) : (
        <WeekView cursor={cursor} tasks={tasks} onToggle={toggleTask} onSlotClick={openQuick} />
      )}

      <QuickAddDialog open={quickOpen} onOpenChange={setQuickOpen} date={quickDate} initialTab="task" />
    </div>
  );
};

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const MonthView: React.FC<{
  cursor: Date;
  tasks: Task[];
  onDayClick: (d: Date) => void;
  onDayAdd: (d: Date) => void;
}> = ({ cursor, tasks, onDayClick, onDayAdd }) => {
  const grid = useMemo(() => {
    const start = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  }, [cursor]);

  const today = new Date();

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border-soft">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-3 py-2 text-[11px] uppercase tracking-wider text-text-muted font-medium">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 grid-rows-6">
        {grid.map((d) => {
          const iso = isoDate(d);
          const dayTasks = tasks.filter((t) => t.date === iso && !t.parent_id);
          const isCurMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          return (
            <div
              key={iso}
              className={`group min-h-[110px] border-b border-r border-border-soft p-2 last:border-r-0 transition-colors ${isCurMonth ? '' : 'bg-bg-soft/40'} hover:bg-bg-soft cursor-pointer`}
              onClick={() => onDayClick(d)}
            >
              <div className="flex items-center justify-between mb-1">
                <span className={`text-xs font-semibold tabular-nums ${
                  isToday ? 'h-6 w-6 rounded-full bg-accent text-white flex items-center justify-center'
                  : isCurMonth ? 'text-text' : 'text-text-dim'
                }`}>
                  {d.getDate()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDayAdd(d); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity h-5 w-5 rounded-md hover:bg-bg-hover flex items-center justify-center"
                  title="Добавить задачу"
                >
                  <Plus className="h-3 w-3 text-text-muted" />
                </button>
              </div>
              <div className="space-y-1">
                {dayTasks.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="rounded-md px-1.5 py-0.5 text-[10px] truncate"
                    style={{
                      background: `${BLOCK_COLOR[t.time_block ?? 'day']}25`,
                      color: '#0f172a',
                    }}
                    title={t.title}
                  >
                    {t.start_time && <b className="tabular-nums mr-1">{t.start_time}</b>}
                    <span className={t.status === 'done' ? 'line-through opacity-60' : ''}>{t.title}</span>
                  </div>
                ))}
                {dayTasks.length > 3 && (
                  <div className="text-[10px] text-text-muted">+ ещё {dayTasks.length - 3}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06..23

const WeekView: React.FC<{
  cursor: Date;
  tasks: Task[];
  onToggle: (id: string) => void;
  onSlotClick: (d: Date) => void;
}> = ({ cursor, tasks, onToggle, onSlotClick }) => {
  const ws = startOfWeek(cursor, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const today = new Date();

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] border-b border-border-soft">
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, today);
          return (
            <div key={d.toISOString()} className="px-3 py-2 text-center border-l border-border-soft">
              <div className="text-[11px] uppercase tracking-wider text-text-muted font-medium">
                {format(d, 'EEE', { locale: ru })}
              </div>
              <div className={`text-lg font-bold mt-0.5 ${
                isToday ? 'inline-flex h-8 w-8 rounded-full bg-accent text-white items-center justify-center mx-auto' : 'text-text'
              }`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Time grid */}
      <div className="grid grid-cols-[60px_repeat(7,minmax(0,1fr))] relative">
        {/* Hours column */}
        <div>
          {HOURS.map((h) => (
            <div key={h} className="h-14 px-2 text-[10px] text-text-muted text-right pt-1 border-b border-border-soft">
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>
        {/* Day columns */}
        {days.map((d) => {
          const iso = isoDate(d);
          const dayTasks = tasks.filter((t) => t.date === iso && !t.parent_id && t.start_time);
          return (
            <div key={iso} className="border-l border-border-soft relative" onClick={() => onSlotClick(d)}>
              {HOURS.map((h) => (
                <div key={h} className="h-14 border-b border-border-soft hover:bg-bg-soft/50 transition-colors" />
              ))}
              {/* Absolute positioned events */}
              {dayTasks.map((t) => {
                const start = t.start_time!;
                const [hh, mm] = start.split(':').map(Number);
                const offsetMin = (hh - 6) * 60 + mm;
                if (offsetMin < 0 || offsetMin > 18 * 60) return null;
                const dur = t.estimate_min ?? 30;
                const top = (offsetMin / 60) * 56;
                const height = Math.max(20, (dur / 60) * 56);
                const color = BLOCK_COLOR[t.time_block ?? 'day'];
                return (
                  <button
                    key={t.id}
                    onClick={(e) => { e.stopPropagation(); onToggle(t.id); }}
                    className="absolute left-1 right-1 rounded-md px-2 py-1 text-[10px] text-left overflow-hidden transition-all hover:z-10 hover:shadow-soft"
                    style={{
                      top: `${top}px`,
                      height: `${height}px`,
                      background: `${color}33`,
                      borderLeft: `3px solid ${color}`,
                      color: '#0f172a',
                    }}
                    title={`${t.title} · ${start}${t.estimate_min ? ` · ${t.estimate_min} мин` : ''}`}
                  >
                    <div className="font-semibold truncate tabular-nums">{start}</div>
                    <div className={`truncate ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};
