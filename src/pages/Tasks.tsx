import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Trash2, Plus, ChevronRight, ChevronDown, CornerDownRight, Play, GripVertical } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { PomodoroTimer } from '@/components/PomodoroTimer';
import {
  DndContext, DragOverlay, PointerSensor, useDroppable, useDraggable, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';

const PRIORITY_COLUMNS = [
  { id: 1, label: 'Высокий', color: '#ef4444' },
  { id: 2, label: 'Средний', color: '#eab308' },
  { id: 3, label: 'Низкий',  color: '#737373' },
] as const;

export const TasksPage: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks, goals, addTask, updateTask, toggleTask, removeTask } = useStore();
  const [view, setView] = useState<'list' | 'kanban'>('list');
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const [filter, setFilter] = useState<'today' | 'all' | 'open' | 'done'>('today');
  const [tagFilter, setTagFilter] = useState<string>('__all');
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [goalId, setGoalId] = useState<string>('__none');
  const [block, setBlock] = useState<string>('day');
  const [startTime, setStartTime] = useState<string>('');
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [pomodoroFor, setPomodoroFor] = useState<Task | null>(null);
  const today = isoDate(date);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    tasks.forEach((t) => t.tags?.split(',').forEach((x) => x.trim() && s.add(x.trim())));
    return Array.from(s).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'today' && t.date !== today) return false;
      if (filter === 'open' && t.status !== 'active') return false;
      if (filter === 'done' && t.status !== 'done') return false;
      if (tagFilter !== '__all') {
        const tags = (t.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean);
        if (!tags.includes(tagFilter)) return false;
      }
      return true;
    });
  }, [tasks, filter, today, tagFilter]);

  // build tree (only roots filtered; children attached even if filtered out)
  const byParent = useMemo(() => {
    const m: Record<string, Task[]> = {};
    tasks.forEach((t) => {
      if (t.parent_id) (m[t.parent_id] ??= []).push(t);
    });
    return m;
  }, [tasks]);

  const roots = filtered.filter((t) => !t.parent_id);

  const blockFromTime = (hhmm: string): 'morning' | 'day' | 'evening' | 'night' => {
    const h = Number(hhmm.split(':')[0] || '12');
    if (h >= 6 && h < 12) return 'morning';
    if (h >= 12 && h < 16) return 'day';
    if (h >= 16 && h < 20) return 'evening';
    return 'night';
  };

  const submit = (parentId: string | null = null) => {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      date: today,
      time_block: (startTime ? blockFromTime(startTime) : block) as any,
      start_time: startTime || null,
      goal_id: goalId === '__none' ? null : goalId,
      parent_id: parentId,
      tags: tagInput.trim() || null,
    });
    setTitle('');
    setTagInput('');
    setStartTime('');
  };

  const TaskRow: React.FC<{ task: Task; depth: number }> = ({ task, depth }) => {
    const goal = goals.find((g) => g.id === task.goal_id);
    const children = byParent[task.id] ?? [];
    const tags = (task.tags ?? '').split(',').map((x) => x.trim()).filter(Boolean);
    const expanded = !collapsed[task.id];
    return (
      <>
        <div className="flex items-center gap-3 p-3" style={{ paddingLeft: 12 + depth * 24 }}>
          {children.length > 0 ? (
            <button onClick={() => setCollapsed((c) => ({ ...c, [task.id]: !c[task.id] }))} className="text-text-muted">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          ) : depth > 0 ? (
            <CornerDownRight className="h-3.5 w-3.5 text-text-dim" />
          ) : (
            <div className="w-3.5" />
          )}
          <Checkbox checked={task.status === 'done'} onCheckedChange={() => toggleTask(task.id)} />
          <div className="flex-1 min-w-0">
            <div className={task.status === 'done' ? 'line-through text-text-muted' : ''}>{task.title}</div>
            <div className="text-[11px] text-text-muted flex flex-wrap items-center gap-2 mt-0.5">
              <span>{task.date}</span>
              {task.start_time && <span className="text-text">· {task.start_time}</span>}
              {!task.start_time && task.time_block && <span>· {task.time_block}</span>}
              {task.estimate_min && <span>· ~{task.estimate_min} мин</span>}
              {goal && <Badge tone="accent">{goal.title}</Badge>}
              {tags.map((tg) => <Badge key={tg} tone="info">#{tg}</Badge>)}
            </div>
          </div>
          <Button variant="ghost" size="icon" title="Pomodoro" onClick={() => setPomodoroFor(task)}>
            <Play className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" title="Подзадача" onClick={() => {
            const sub = window.prompt('Название подзадачи:');
            if (sub?.trim()) addTask({ title: sub.trim(), date: task.date, parent_id: task.id, goal_id: task.goal_id });
          }}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => removeTask(task.id)}>
            <Trash2 className="h-4 w-4 text-text-muted" />
          </Button>
        </div>
        {expanded && children.map((c) => <TaskRow key={c.id} task={c} depth={depth + 1} />)}
      </>
    );
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-h1">Задачи</h1>
        <div className="flex gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as any)}>
            <TabsList>
              <TabsTrigger value="list">Список</TabsTrigger>
              <TabsTrigger value="kanban">Приоритет</TabsTrigger>
            </TabsList>
          </Tabs>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Тег" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Все теги</SelectItem>
              {allTags.map((tg) => <SelectItem key={tg} value={tg}>#{tg}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Сегодня</SelectItem>
              <SelectItem value="open">Активные</SelectItem>
              <SelectItem value="done">Выполненные</SelectItem>
              <SelectItem value="all">Все</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <div className="flex flex-wrap gap-2">
          <Input className="flex-1 min-w-[160px]" placeholder="Новая задача..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <Input className="w-40" placeholder="теги через ," value={tagInput} onChange={(e) => setTagInput(e.target.value)} />
          <Input type="time" className="w-28" value={startTime} onChange={(e) => setStartTime(e.target.value)} title="Точное время" />
          <Select value={block} onValueChange={setBlock}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="morning">Утро</SelectItem>
              <SelectItem value="day">День</SelectItem>
              <SelectItem value="evening">Вечер</SelectItem>
              <SelectItem value="night">Ночь</SelectItem>
            </SelectContent>
          </Select>
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Цель" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Без цели</SelectItem>
              {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={() => submit()}><Plus /> Добавить</Button>
        </div>
      </Card>

      {view === 'list' ? (
        <Card className="p-0">
          <div className="row-divide">
            {roots.length === 0 && <div className="p-6 text-text-muted text-sm">Нет задач</div>}
            {roots.map((t) => <TaskRow key={t.id} task={t} depth={0} />)}
          </div>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setDraggingId(String(e.active.id))}
          onDragCancel={() => setDraggingId(null)}
          onDragEnd={(e: DragEndEvent) => {
            setDraggingId(null);
            if (!e.over) return;
            const taskId = String(e.active.id);
            const priority = Number(String(e.over.id).replace('priority-', ''));
            if ([1, 2, 3].includes(priority)) updateTask(taskId, { priority });
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {PRIORITY_COLUMNS.map((col) => {
              const items = filtered.filter((t) => !t.parent_id && t.priority === col.id);
              return (
                <PriorityColumn key={col.id} id={`priority-${col.id}`} label={col.label} color={col.color} count={items.length}>
                  {items.length === 0 && <div className="text-xs text-text-dim p-3">Пусто</div>}
                  {items.map((t) => {
                    const goal = goals.find((g) => g.id === t.goal_id);
                    return (
                      <DraggableCard key={t.id} task={t} title={t.title}>
                        <div className="flex items-start gap-2">
                          <span onClick={(ev) => ev.stopPropagation()}>
                            <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium leading-snug ${t.status === 'done' ? 'line-through text-text-muted' : ''}`}>
                              {t.title}
                            </div>
                            <div className="text-[11px] text-text-muted mt-0.5 flex flex-wrap gap-2">
                              {t.start_time && <span className="tabular-nums">{t.start_time}</span>}
                              {t.time_block && !t.start_time && <span>{t.time_block}</span>}
                              {goal && <Badge tone="accent">{goal.title}</Badge>}
                            </div>
                          </div>
                        </div>
                      </DraggableCard>
                    );
                  })}
                </PriorityColumn>
              );
            })}
          </div>
          <DragOverlay>
            {draggingId ? (() => {
              const t = tasks.find((x) => x.id === draggingId);
              return t ? (
                <div className="border border-border bg-bg-card p-2 text-sm shadow-2xl max-w-[260px]">
                  {t.title}
                </div>
              ) : null;
            })() : null}
          </DragOverlay>
        </DndContext>
      )}

      <PomodoroTimer task={pomodoroFor} onClose={() => setPomodoroFor(null)} />
    </div>
  );
};

const PriorityColumn: React.FC<{
  id: string;
  label: string;
  color: string;
  count: number;
  children: React.ReactNode;
}> = ({ id, label, color, count, children }) => {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`border transition-all ${isOver ? 'border-text bg-bg-hover' : 'border-border'}`}
    >
      <div className="flex items-center justify-between p-3 border-b border-border" style={{ borderTopColor: color, borderTopWidth: 3 }}>
        <div className="text-sm font-semibold" style={{ color }}>{label}</div>
        <span className="text-[11px] text-text-muted tabular-nums">{count}</span>
      </div>
      <div className="p-2 space-y-2 min-h-[200px]">
        {children}
      </div>
    </div>
  );
};

const DraggableCard: React.FC<{ task: Task; title: string; children: React.ReactNode }> = ({ task, children }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      className={`border border-border bg-bg-card p-2 group ${isDragging ? 'opacity-30' : ''} hover:border-text transition-colors`}
    >
      <div className="flex items-start gap-1">
        <button
          {...listeners}
          {...attributes}
          className="cursor-grab active:cursor-grabbing text-text-dim hover:text-text shrink-0 pt-0.5"
          aria-label="Перетащить"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
};
