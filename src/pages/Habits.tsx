import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2, Check } from 'lucide-react';
import { addDays } from 'date-fns';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';

export const HabitsPage = () => {
  const { habits, habitLogs, goals, addHabit, removeHabit, toggleHabitLog } = useStore();
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState<string>('__none');

  const days = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => isoDate(addDays(today, -29 + i)));
  }, []);

  const submit = () => {
    if (!title.trim()) return;
    addHabit({ title: title.trim(), goal_id: goalId === '__none' ? null : goalId });
    setTitle('');
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-h1">Привычки</h1>

      <Card>
        <div className="flex gap-2">
          <Input placeholder="Новая привычка..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
          <Select value={goalId} onValueChange={setGoalId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="Цель" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">Без цели</SelectItem>
              {goals.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={submit}><Plus /> Добавить</Button>
        </div>
      </Card>

      <Card className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-text-muted text-[11px]">
              <th className="text-left p-3 sticky left-0 bg-bg-card">Привычка</th>
              {days.map((d) => (
                <th key={d} className="p-1 font-normal w-7">{d.slice(8)}</th>
              ))}
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {habits.map((h) => (
              <tr key={h.id} className="border-t border-border-soft hover:bg-bg-hover/50">
                <td className="p-3 sticky left-0 bg-bg-card">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full" style={{ background: h.color ?? '#22c55e' }} />
                    <span>{h.title}</span>
                  </div>
                </td>
                {days.map((d) => {
                  const done = habitLogs.some((l) => l.habit_id === h.id && l.date === d);
                  return (
                    <td key={d} className="p-1 text-center">
                      <button
                        onClick={() => toggleHabitLog(h.id, d)}
                        className="h-6 w-6 rounded-md border border-border bg-bg-soft flex items-center justify-center hover:border-accent transition-colors"
                        style={{ background: done ? (h.color ?? '#22c55e') : undefined, borderColor: done ? (h.color ?? '#22c55e') : undefined }}
                      >
                        {done && <Check className="h-3 w-3 text-black" strokeWidth={3} />}
                      </button>
                    </td>
                  );
                })}
                <td className="p-3">
                  <Button variant="ghost" size="icon" onClick={() => removeHabit(h.id)}>
                    <Trash2 className="h-4 w-4 text-text-muted" />
                  </Button>
                </td>
              </tr>
            ))}
            {habits.length === 0 && <tr><td colSpan={days.length + 2} className="p-6 text-center text-text-muted">Нет привычек</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
