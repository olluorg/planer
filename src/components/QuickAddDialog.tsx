import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from './ui/dialog';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  date: Date;
  initialTab?: 'task' | 'habit' | 'goal' | 'progress';
}

export const QuickAddDialog: React.FC<Props> = ({ open, onOpenChange, date, initialTab }) => {
  const goals = useStore((s) => s.goals);
  const addTask = useStore((s) => s.addTask);
  const addHabit = useStore((s) => s.addHabit);
  const addGoal = useStore((s) => s.addGoal);
  const addProgress = useStore((s) => s.addProgress);

  const [tab, setTab] = useState<string>(initialTab ?? 'task');
  useEffect(() => { if (open && initialTab) setTab(initialTab); }, [open, initialTab]);
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState<string | undefined>(undefined);
  const [block, setBlock] = useState<string>('day');
  const [target, setTarget] = useState('100');
  const [progressValue, setProgressValue] = useState('');

  const reset = () => {
    setTitle('');
    setProgressValue('');
  };

  const submit = () => {
    if (tab === 'task' && title.trim()) {
      addTask({
        title: title.trim(),
        goal_id: goalId ?? null,
        date: isoDate(date),
        time_block: block as any,
        priority: 2,
      });
    } else if (tab === 'habit' && title.trim()) {
      addHabit({ title: title.trim(), goal_id: goalId ?? null, schedule: 'daily' });
    } else if (tab === 'goal' && title.trim()) {
      addGoal({ title: title.trim(), target_value: Number(target) || 100, type: 'mid' });
    } else if (tab === 'progress' && goalId && progressValue) {
      addProgress({ goal_id: goalId, date: isoDate(date), value: Number(progressValue), note: null });
    }
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Быстрое добавление</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="task" className="flex-1">Задача</TabsTrigger>
            <TabsTrigger value="habit" className="flex-1">Привычка</TabsTrigger>
            <TabsTrigger value="goal" className="flex-1">Цель</TabsTrigger>
            <TabsTrigger value="progress" className="flex-1">Показатель</TabsTrigger>
          </TabsList>

          <TabsContent value="task" className="space-y-3 pt-4">
            <Input placeholder="Название задачи" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <div className="grid grid-cols-2 gap-2">
              <Select value={block} onValueChange={setBlock}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">06:00–12:00</SelectItem>
                  <SelectItem value="day">12:00–16:00</SelectItem>
                  <SelectItem value="evening">16:00–20:00</SelectItem>
                  <SelectItem value="night">20:00–23:00</SelectItem>
                </SelectContent>
              </Select>
              <Select value={goalId ?? '__none'} onValueChange={(v) => setGoalId(v === '__none' ? undefined : v)}>
                <SelectTrigger><SelectValue placeholder="Цель" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">Без цели</SelectItem>
                  {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="habit" className="space-y-3 pt-4">
            <Input placeholder="Название привычки" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <Select value={goalId ?? '__none'} onValueChange={(v) => setGoalId(v === '__none' ? undefined : v)}>
              <SelectTrigger><SelectValue placeholder="Цель" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">Без цели</SelectItem>
                {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </TabsContent>

          <TabsContent value="goal" className="space-y-3 pt-4">
            <Input placeholder="Название цели" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
            <Input type="number" placeholder="Целевое значение" value={target} onChange={(e) => setTarget(e.target.value)} />
          </TabsContent>

          <TabsContent value="progress" className="space-y-3 pt-4">
            <Select value={goalId ?? ''} onValueChange={setGoalId}>
              <SelectTrigger><SelectValue placeholder="Цель" /></SelectTrigger>
              <SelectContent>
                {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input type="number" placeholder="Текущее значение" value={progressValue} onChange={(e) => setProgressValue(e.target.value)} />
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Отмена</Button>
          </DialogClose>
          <Button onClick={submit}>Добавить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
