import { useMemo, useState } from 'react';
import { DndContext, DragOverlay, PointerSensor, useDroppable, useDraggable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { Card, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
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

export const PlanPage: React.FC<{ date: Date }> = ({ date }) => {
  const [mode, setMode] = useState<'day' | 'week'>('day');
  const { tasks, updateTask, toggleTask } = useStore();
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const [activeId, setActiveId] = useState<string | null>(null);

  const onEnd = (e: DragEndEvent) => {
    setActiveId(null);
    if (!e.over) return;
    const id = String(e.active.id);
    const overId = String(e.over.id);
    const [d, b] = overId.split('|');
    updateTask(id, { date: d, time_block: (b || null) as any });
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
  const today = tasks.filter((t) => t.date === d);
  return (
    <div className="bento-grid-kpi">
      {BLOCKS.map((b) => (
        <Column key={b.key} id={`${d}|${b.key}`} title={b.label}>
          {today.filter((t) => t.time_block === b.key).map((t) => (
            <DraggableTask key={t.id} task={t} onToggle={onToggle} />
          ))}
        </Column>
      ))}
    </div>
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

const Column: React.FC<{ id: string; title: string; children?: React.ReactNode; compact?: boolean }> = ({ id, title, children, compact }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <Card ref={setNodeRef as any} className={`min-h-[280px] transition-colors ${isOver ? 'ring-1 ring-accent border-accent' : ''}`}>
      <CardTitle>{title}</CardTitle>
      <div className={`space-y-2 ${compact ? 'text-xs' : ''}`}>{children}</div>
    </Card>
  );
};

const DraggableTask: React.FC<{ task: any; onToggle: (id: string) => void; compact?: boolean }> = ({ task, onToggle, compact }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 rounded-md border border-border bg-bg-soft p-2 ${isDragging ? 'opacity-50' : ''} hover:border-accent/40 transition-colors`}
    >
      <Checkbox checked={task.status === 'done'} onCheckedChange={() => onToggle(task.id)} />
      <div className="flex-1 cursor-grab active:cursor-grabbing" {...listeners} {...attributes}>
        <div className={task.status === 'done' ? 'line-through text-text-muted' : ''}>{task.title}</div>
        {!compact && task.priority === 1 && <Badge tone="danger" className="mt-1">высокий</Badge>}
      </div>
    </div>
  );
};
