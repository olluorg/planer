import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { startOfMonth, startOfWeek, addDays, format, isSameMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { X, ArrowUpRight, Plus, CalendarDays } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

/** Компактный месяц на дашборде. Клик по любой дате → панель дня: задачи + быстрое
 *  добавление (как в Google Calendar). Закрывается кликом вне, Esc и крестиком. */
export const CalendarWidget: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks, toggleTask, addTask } = useStore();
  const today = isoDate(new Date());
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);

  const grid = useMemo(() => {
    const gStart = startOfWeek(startOfMonth(date), { weekStartsOn: 1 });
    return Array.from({ length: 42 }, (_, i) => addDays(gStart, i));
  }, [date]);

  const taskDays = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => { if (t.status === 'active' && !t.parent_id) s.add(t.date); });
    return s;
  }, [tasks]);

  const dayTasks = useMemo(
    () => (sel ? tasks.filter((t) => t.date === sel && !t.parent_id).sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')) : []),
    [sel, tasks],
  );

  // Закрытие по клику вне панели и по Esc
  useEffect(() => {
    if (!sel) return;
    const onDown = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setSel(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [sel]);

  const open = (iso: string) => { setSel(iso); setDraft(''); };
  const add = () => {
    const title = draft.trim();
    if (!title || !sel) return;
    addTask({ title, date: sel });
    setDraft('');
  };

  return (
    <div className="relative h-full flex flex-col rounded-xl bg-bg-card border border-border shadow-card p-4 overflow-hidden">
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
            <button
              key={i}
              onClick={() => open(iso)}
              className={`relative flex items-center justify-center rounded-md text-[11px] tabular-nums transition-colors hover:ring-1 hover:ring-accent/40 ${
                sel === iso ? 'ring-1 ring-accent' : ''
              } ${isToday ? 'bg-accent text-white font-semibold' : inMonth ? 'text-text hover:bg-bg-soft' : 'text-text-dim/60 hover:bg-bg-soft'}`}
            >
              {d.getDate()}
              {has && !isToday && <span className="absolute bottom-[3px] h-1 w-1 rounded-full bg-accent" />}
            </button>
          );
        })}
      </div>

      {/* Панель дня — открывается всегда, даже если задач нет (можно сразу добавить) */}
      {sel && (
        <div ref={panelRef} className="modal-surface absolute inset-x-2 bottom-2 top-9 z-20 rounded-xl bg-bg-elevated backdrop-blur-xl border border-border shadow-2xl flex flex-col overflow-hidden animate-[slide-up_140ms_ease-out]">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border-soft shrink-0 bg-bg-soft/60">
            <CalendarDays className="h-4 w-4 text-accent shrink-0" />
            <span className="text-sm font-semibold text-text capitalize flex-1 truncate">{format(new Date(`${sel}T00:00:00`), 'd MMMM, EEEE', { locale: ru })}</span>
            <button
              onClick={() => { window.dispatchEvent(new CustomEvent('thedad:expand', { detail: { page: 'plan' } })); setSel(null); }}
              className="h-7 w-7 rounded-lg bg-bg-card border border-border-soft hover:border-accent/50 flex items-center justify-center text-text-muted hover:text-accent transition-colors" title="Открыть в плане"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setSel(null)}
              className="h-7 w-7 rounded-lg bg-bg-card border border-border-soft hover:border-danger/50 hover:text-danger flex items-center justify-center text-text-muted transition-colors" title="Закрыть (Esc)"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {dayTasks.length === 0 && (
              <div className="text-xs text-text-dim px-1.5 py-3 text-center">Задач нет — добавь первую ниже ↓</div>
            )}
            {dayTasks.map((t) => (
              <label key={t.id} className="flex items-center gap-2 px-1.5 py-1.5 rounded-lg hover:bg-bg-soft cursor-pointer">
                <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
                {t.start_time && <span className="text-[10px] text-text-dim tabular-nums shrink-0">{t.start_time}</span>}
                <span className={`text-xs flex-1 min-w-0 truncate ${t.status === 'done' ? 'line-through text-text-muted' : 'text-text'}`}>{t.title}</span>
              </label>
            ))}
          </div>

          {/* Быстрое добавление */}
          <div className="flex gap-2 p-2 border-t border-border-soft shrink-0">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
              autoFocus
              placeholder="+ Задача на этот день…"
              className="flex-1 min-w-0 h-8 rounded-lg bg-bg-soft border border-border-soft px-2.5 text-xs outline-none focus:border-accent"
            />
            <button onClick={add} disabled={!draft.trim()} className="h-8 w-8 rounded-lg bg-accent text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 shrink-0 transition-opacity">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
