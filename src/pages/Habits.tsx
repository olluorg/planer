import { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Plus, Trash2, Check, Flame } from 'lucide-react';
import { addDays, startOfWeek, format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export const HabitsPage = () => {
  const { habits, habitLogs, goals, addHabit, removeHabit, toggleHabitLog } = useStore();
  const [title, setTitle] = useState('');
  const [goalId, setGoalId] = useState<string>('__none');
  const [view, setView] = useState<'week' | 'month'>('week');

  const weekDates = useMemo(() => {
    const ws = startOfWeek(new Date(), { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => isoDate(addDays(ws, i)));
  }, []);

  const monthDays = useMemo(() => {
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => isoDate(addDays(today, -29 + i)));
  }, []);

  const habitStreak = (habitId: string): number => {
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = isoDate(addDays(new Date(), -i));
      if (habitLogs.some((l) => l.habit_id === habitId && l.date === d)) streak++;
      else if (i > 0) break;
    }
    return streak;
  };

  const submit = () => {
    if (!title.trim()) return;
    addHabit({ title: title.trim(), goal_id: goalId === '__none' ? null : goalId });
    setTitle('');
  };

  const todayIso = isoDate(new Date());

  return (
    <div className="page py-4 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-h1">Привычки</h1>
        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="week">Неделя</TabsTrigger>
            <TabsTrigger value="month">Месяц</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <Card>
        <div className="flex gap-2 flex-wrap">
          <Input className="flex-1 min-w-[160px]" placeholder="Новая привычка..." value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
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

      {habits.length === 0 && (
        <Card className="p-8 text-center text-sm text-text-muted">Нет привычек — добавь первую выше</Card>
      )}

      {view === 'week' ? (
        <Card className="p-0 overflow-hidden">
          {/* header */}
          <div className="grid grid-cols-[1fr_repeat(7,40px)_56px] items-center px-4 py-2 border-b border-border-soft text-[11px] text-text-muted">
            <div>Привычка</div>
            {weekDates.map((d, i) => (
              <div key={d} className={`text-center font-medium ${d === todayIso ? 'text-accent' : ''}`}>{WEEKDAYS[i]}</div>
            ))}
            <div className="text-center">Серия</div>
          </div>
          <div className="divide-y divide-border-soft">
            {habits.map((h) => {
              const color = h.color ?? '#6366f1';
              const streak = habitStreak(h.id);
              const doneWeek = weekDates.filter((d) => habitLogs.some((l) => l.habit_id === h.id && l.date === d)).length;
              return (
                <div key={h.id} className="grid grid-cols-[1fr_repeat(7,40px)_56px] items-center px-4 py-2.5 hover:bg-bg-soft group">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
                    <span className="truncate text-sm">{h.title}</span>
                    <span className="text-[11px] text-text-dim tabular-nums">{doneWeek}/7</span>
                  </div>
                  {weekDates.map((d) => {
                    const done = habitLogs.some((l) => l.habit_id === h.id && l.date === d);
                    const future = d > todayIso;
                    return (
                      <div key={d} className="flex justify-center">
                        <button
                          onClick={() => !future && toggleHabitLog(h.id, d)}
                          disabled={future}
                          className="h-7 w-7 rounded-full border-2 flex items-center justify-center transition-all disabled:opacity-30 hover:scale-110"
                          style={{
                            background: done ? color : 'transparent',
                            borderColor: done ? color : 'var(--border)',
                          }}
                        >
                          {done && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                        </button>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-center gap-1">
                    {streak > 0 ? (
                      <>
                        <Flame className="h-3.5 w-3.5 text-warning" />
                        <span className="text-sm font-semibold tabular-nums">{streak}</span>
                      </>
                    ) : <span className="text-text-dim text-xs">—</span>}
                    <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 h-7 w-7" onClick={() => removeHabit(h.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-text-muted" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-text-muted text-[11px]">
                <th className="text-left p-3 sticky left-0 bg-bg-card">Привычка</th>
                {monthDays.map((d) => (
                  <th key={d} className="p-1 font-normal w-7">{d.slice(8)}</th>
                ))}
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {habits.map((h) => (
                <tr key={h.id} className="border-t border-border-soft hover:bg-bg-soft">
                  <td className="p-3 sticky left-0 bg-bg-card">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ background: h.color ?? '#6366f1' }} />
                      <span>{h.title}</span>
                    </div>
                  </td>
                  {monthDays.map((d) => {
                    const done = habitLogs.some((l) => l.habit_id === h.id && l.date === d);
                    const color = h.color ?? '#6366f1';
                    return (
                      <td key={d} className="p-1 text-center">
                        <button
                          onClick={() => toggleHabitLog(h.id, d)}
                          className="h-6 w-6 rounded-md border border-border bg-bg-soft flex items-center justify-center hover:border-accent transition-colors"
                          style={{ background: done ? color : undefined, borderColor: done ? color : undefined }}
                        >
                          {done && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
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
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};
