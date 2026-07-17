import { useEffect, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Card, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Ring } from '@/components/ui/ring';
import { Crosshair } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { addDays, format, startOfWeek } from 'date-fns';
import { ru } from 'date-fns/locale';

const BLOCKS = [
  { key: 'morning', label: 'Утро · 06–12' },
  { key: 'day', label: 'День · 12–16' },
  { key: 'evening', label: 'Вечер · 16–20' },
  { key: 'night', label: 'Ночь · 20–23' },
] as const;

const BLOCK_COLORS: Record<string, string> = { morning: '#f59e0b', day: '#6366f1', evening: '#8b5cf6', night: '#3b82f6' };

// Hour-by-hour timeline (06:00…23:00) — «План дня» как тайм-блок-сетка.
const DAY_START = 6;
const DAY_END = 23;
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i); // 06..22
const ROW_H = 56; // px per hour (h-14)

const blockForHour = (h: number): 'morning' | 'day' | 'evening' | 'night' =>
  h < 12 ? 'morning' : h < 16 ? 'day' : h < 20 ? 'evening' : 'night';

export const PlanPage: React.FC<{ date: Date }> = ({ date }) => {
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const { tasks, updateTask, toggleTask } = useStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const parts = String(e.over.id).split('|');
    const d = parts[0];
    if (parts[1] === 'hour') {
      const h = Number(parts[2]);
      updateTask(id, { date: d, time_block: blockForHour(h), start_time: `${String(h).padStart(2, '0')}:00` });
    } else if (parts[1] === 'unscheduled') {
      updateTask(id, { date: d, start_time: null as any });
    } else {
      // week column: parts[1] is '' → clear time-block
      updateTask(id, { date: d, time_block: (parts[1] || null) as any });
    }
  };

  return (
    <div className="page py-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-h1">Планирование</h1>
        <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
          <TabsList>
            <TabsTrigger value="day">День</TabsTrigger>
            <TabsTrigger value="week">Неделя</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <DndContext sensors={sensors} onDragStart={(e) => setActiveId(String(e.active.id))} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
        {mode === 'day' ? <DayView date={date} tasks={tasks} onToggle={toggleTask} /> : <WeekView date={date} tasks={tasks} onToggle={toggleTask} />}
        <DragOverlay>
          {activeId ? (() => {
            const t = tasks.find((x) => x.id === activeId);
            return t ? <div className="card p-2 shadow-2xl text-sm">{t.title}</div> : null;
          })() : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

const DayView: React.FC<{ date: Date; tasks: any[]; onToggle: (id: string) => void }> = ({ date, tasks, onToggle }) => {
  const d = isoDate(date);
  const today = tasks.filter((t) => t.date === d && !t.parent_id);
  const scheduled = today.filter((t) => t.start_time);
  const unscheduled = today.filter((t) => !t.start_time);

  return (
    <div className="flex flex-col xl:flex-row gap-4 items-start">
      <div className="flex-1 min-w-0 space-y-4">
        <UnscheduledStrip id={`${d}|unscheduled`} tasks={unscheduled} onToggle={onToggle} />
        <TimelineGrid date={date} d={d} tasks={scheduled} onToggle={onToggle} />
      </div>
      <FocusRail date={date} />
    </div>
  );
};

const UnscheduledStrip: React.FC<{ id: string; tasks: any[]; onToggle: (id: string) => void }> = ({ id, tasks, onToggle }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card ref={setNodeRef as any} className={`transition-colors ${isOver ? 'ring-1 ring-accent border-accent' : ''}`}>
      <CardTitle>Без времени</CardTitle>
      {tasks.length ? (
        <div className="flex flex-wrap gap-2">
          {tasks.map((t) => <DraggableTask key={t.id} task={t} onToggle={onToggle} chip />)}
        </div>
      ) : (
        <div className="text-small text-text-muted">Перетащи задачу на час, чтобы назначить время</div>
      )}
    </Card>
  );
};

const TimelineGrid: React.FC<{ date: Date; d: string; tasks: any[]; onToggle: (id: string) => void }> = ({ date, d, tasks, onToggle }) => {
  const isToday = isoDate(new Date()) === d;
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!isToday) return;
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, [isToday]);

  const nowOffset = isToday ? (now.getHours() - DAY_START) * 60 + now.getMinutes() : -1;
  const nowTop = (nowOffset / 60) * ROW_H;
  const showNow = isToday && nowOffset >= 0 && nowOffset <= (DAY_END - DAY_START) * 60;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="grid grid-cols-[56px_minmax(0,1fr)] relative">
        {/* Hours column */}
        <div>
          {HOURS.map((h) => (
            <div key={h} className="px-2 text-[10px] text-text-muted text-right pt-1 border-b border-border-soft" style={{ height: ROW_H }}>
              {String(h).padStart(2, '0')}:00
            </div>
          ))}
        </div>

        {/* Events column with per-hour droppables */}
        <div className="relative border-l border-border-soft">
          {HOURS.map((h) => <HourSlot key={h} id={`${d}|hour|${h}`} />)}

          {tasks.map((t) => {
            const [hh, mm] = String(t.start_time).split(':').map(Number);
            const offsetMin = (hh - DAY_START) * 60 + mm;
            if (offsetMin < 0 || offsetMin > (DAY_END - DAY_START) * 60) return null;
            return (
              <TimelineEvent
                key={t.id}
                task={t}
                onToggle={onToggle}
                top={(offsetMin / 60) * ROW_H}
                // минимум — чтобы поместились и время, и название задачи (раньше 22px их резало)
                height={Math.max(46, ((t.estimate_min ?? 30) / 60) * ROW_H)}
                color={BLOCK_COLORS[t.time_block ?? blockForHour(hh)]}
              />
            );
          })}

          {showNow && (
            <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center" style={{ top: nowTop }}>
              <span className="h-2 w-2 rounded-full bg-danger -ml-1 shrink-0" />
              <span className="h-px flex-1 bg-danger/70" />
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};

const HourSlot: React.FC<{ id: string }> = ({ id }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`border-b border-border-soft transition-colors ${isOver ? 'bg-accent/10' : 'hover:bg-bg-soft/50'}`}
      style={{ height: ROW_H }}
    />
  );
};

const TimelineEvent: React.FC<{ task: any; onToggle: (id: string) => void; top: number; height: number; color: string }> = ({ task, onToggle, top, height, color }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const done = task.status === 'done';
  return (
    <div
      ref={setNodeRef}
      className={`absolute left-1 right-2 rounded-md px-2 py-1 overflow-hidden transition-shadow ${isDragging ? 'opacity-50 z-20' : 'hover:shadow-soft hover:z-10'}`}
      style={{
        top, height,
        transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
        background: `${color}26`,
        borderLeft: `3px solid ${color}`,
      }}
    >
      <div className="flex items-start gap-1.5">
        <Checkbox checked={done} onCheckedChange={() => onToggle(task.id)} />
        <div className="min-w-0 flex-1 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
          <div className="text-[10px] font-semibold tabular-nums" style={{ color }}>
            {task.start_time}{task.estimate_min ? ` · ${task.estimate_min}м` : ''}
          </div>
          <div className={`text-xs leading-snug line-clamp-2 ${done ? 'line-through text-text-muted' : 'text-text'}`}>{task.title}</div>
        </div>
      </div>
    </div>
  );
};

const FocusRail: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks, timeEntries } = useStore();
  const d = isoDate(date);
  const todayTasks = tasks.filter((t) => t.date === d && !t.parent_id);
  const done = todayTasks.filter((t) => t.status === 'done').length;
  const pct = todayTasks.length ? Math.round((done / todayTasks.length) * 100) : 0;
  const focusMin = Math.round(timeEntries.filter((e) => e.type === 'pomodoro' && isoDate(new Date(e.started_at)) === d).reduce((s, e) => s + e.duration, 0) / 60);
  const focusTask = todayTasks.filter((t) => t.status === 'active').sort((a, b) => a.priority - b.priority)[0];

  return (
    <aside className="w-full xl:w-[300px] shrink-0 space-y-4 xl:sticky xl:top-4 self-start">
      <Card>
        <CardTitle>Фокус-время</CardTitle>
        <div className="flex items-center gap-4">
          <Ring value={pct} size={84} stroke={9} color="#6366f1" glow={false} trackColor="var(--border)">
            <div className="text-sm font-bold tabular-nums">{pct}%</div>
          </Ring>
          <div>
            <div className="text-h3 tabular-nums leading-none">{Math.floor(focusMin / 60)}ч {focusMin % 60}м</div>
            <div className="text-caption text-text-muted mt-1">залогировано сегодня</div>
          </div>
        </div>
      </Card>

      <Card>
        <CardTitle>Тайм-блоки</CardTitle>
        <div className="space-y-2.5">
          {BLOCKS.map((b) => {
            const cnt = todayTasks.filter((t) => t.time_block === b.key).length;
            const dn = todayTasks.filter((t) => t.time_block === b.key && t.status === 'done').length;
            return (
              <div key={b.key} className="flex items-center gap-2 text-small">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: BLOCK_COLORS[b.key] }} />
                <span className="flex-1 text-text-muted">{b.label.split(' · ')[0]}</span>
                <span className="tabular-nums text-text">{dn}/{cnt}</span>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle>Фокус дня</CardTitle>
        {focusTask ? (
          <>
            <div className="text-sm font-medium text-text leading-snug">{focusTask.title}</div>
            <div className="text-caption text-text-muted mt-1 mb-3">Защити время на главное</div>
          </>
        ) : (
          <div className="text-small text-text-muted mb-3">Нет активных задач на сегодня</div>
        )}
        <Button className="w-full" onClick={() => window.dispatchEvent(new CustomEvent('thedad:focus-mode'))}>
          <Crosshair className="h-4 w-4" /> Focus Mode
        </Button>
      </Card>
    </aside>
  );
};

const WeekView: React.FC<{ date: Date; tasks: any[]; onToggle: (id: string) => void }> = ({ date, tasks, onToggle }) => {
  const start = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  return (
    <div className="overflow-x-auto">
    <div className="grid grid-cols-7 gap-2 min-w-[560px]">
      {days.map((d) => {
        const iso = isoDate(d);
        return (
          <Column key={iso} id={`${iso}|`} title={format(d, 'EEE, d MMM', { locale: ru })} compact>
            {tasks.filter((t) => t.date === iso).map((t) => (
              <DraggableTask key={t.id} task={t} onToggle={onToggle} compact />
            ))}
          </Column>
        );
      })}
    </div>
    </div>
  );
};

const Column: React.FC<{ id: string; title: string; children?: React.ReactNode; compact?: boolean; color?: string }> = ({ id, title, children, compact, color }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card ref={setNodeRef as any} className={`min-h-[280px] transition-colors ${isOver ? 'ring-1 ring-accent border-accent' : ''}`}>
      <CardTitle className="flex items-center gap-2">
        {color && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} />}
        {title}
      </CardTitle>
      <div className={`space-y-2 ${compact ? 'text-xs' : ''}`}>{children}</div>
    </Card>
  );
};

const DraggableTask: React.FC<{ task: any; onToggle: (id: string) => void; compact?: boolean; chip?: boolean }> = ({ task, onToggle, compact, chip }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-md border border-border bg-bg-soft p-2 ${chip ? 'max-w-[260px]' : ''} ${isDragging ? 'opacity-50' : ''} hover:border-accent/40 transition-colors`}
    >
      <Checkbox checked={task.status === 'done'} onCheckedChange={() => onToggle(task.id)} />
      <div className="flex-1 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
        <div className={task.status === 'done' ? 'line-through text-text-muted' : ''}>{task.title}</div>
        {!compact && task.priority === 1 && <Badge tone="danger" className="mt-1">высокий</Badge>}
      </div>
    </div>
  );
};
