import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Trash2, Plus, ChevronRight, ChevronDown, CornerDownRight, Play } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import type { Task } from '@/lib/types';
import { PomodoroTimer } from '@/components/PomodoroTimer';

export const TasksPage: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks, goals, addTask, toggleTask, removeTask } = useStore();
  const [filter, setFilter] = useState<'today' | 'all' | 'open' | 'done'>('today');
  const [tagFilter, setTagFilter] = useState<string>('__all');
  const [title, setTitle] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [goalId, setGoalId] = useState<string>('__none');
  const [block, setBlock] = useState<string>('day');
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

  const submit = (parentId: string | null = null) => {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      date: today,
      time_block: block as any,
      goal_id: goalId === '__none' ? null : goalId,
      parent_id: parentId,
      tags: tagInput.trim() || null,
    });
    setTitle('');
    setTagInput('');
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
              {task.time_block && <span>· {task.time_block}</span>}
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
        <h1 className="text-xl font-semibold">Задачи</h1>
        <div className="flex gap-2">
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
          <Select value={block} onValueChange={setBlock}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
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

      <Card className="p-0">
        <div className="row-divide">
          {roots.length === 0 && <div className="p-6 text-text-muted text-sm">Нет задач</div>}
          {roots.map((t) => <TaskRow key={t.id} task={t} depth={0} />)}
        </div>
      </Card>

      <PomodoroTimer task={pomodoroFor} onClose={() => setPomodoroFor(null)} />
    </div>
  );
};
