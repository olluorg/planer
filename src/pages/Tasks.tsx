import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Trash2, Plus } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';

export const TasksPage: React.FC<{ date: Date }> = ({ date }) => {
  const { tasks, goals, addTask, toggleTask, removeTask } = useStore();
  const [filter, setFilter] = useState<'today' | 'all' | 'open' | 'done'>('today');
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState<string>('__none');
  const [block, setBlock] = useState<string>('day');
  const today = isoDate(date);

  const list = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === 'today') return t.date === today;
      if (filter === 'open') return t.status === 'active';
      if (filter === 'done') return t.status === 'done';
      return true;
    });
  }, [tasks, filter, today]);

  const submit = () => {
    if (!title.trim()) return;
    addTask({
      title: title.trim(),
      date: today,
      time_block: block as any,
      goal_id: goalId === '__none' ? null : goalId,
    });
    setTitle('');
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Задачи</h1>
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

      <Card>
        <div className="flex flex-wrap gap-2">
          <Input className="flex-1 min-w-[160px]" placeholder="Новая задача..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
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
          <Button onClick={submit}><Plus /> Добавить</Button>
        </div>
      </Card>

      <Card className="p-0">
        <div className="row-divide">
          {list.length === 0 && <div className="p-6 text-text-muted text-sm">Нет задач</div>}
          {list.map((t) => {
            const goal = goals.find((g) => g.id === t.goal_id);
            return (
              <div key={t.id} className="flex items-center gap-3 p-3">
                <Checkbox checked={t.status === 'done'} onCheckedChange={() => toggleTask(t.id)} />
                <div className="flex-1 min-w-0">
                  <div className={t.status === 'done' ? 'line-through text-text-muted' : ''}>{t.title}</div>
                  <div className="text-[11px] text-text-muted flex gap-2 mt-0.5">
                    <span>{t.date}</span>
                    {t.time_block && <span>· {t.time_block}</span>}
                    {goal && <Badge tone="accent">{goal.title}</Badge>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeTask(t.id)}>
                  <Trash2 className="h-4 w-4 text-text-muted" />
                </Button>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
};
