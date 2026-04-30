import { useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';

export const HistoryPage = () => {
  const { changeLog, goals, tasks, habits } = useStore();
  const [entityFilter, setEntityFilter] = useState<string>('__all');

  const filtered = useMemo(() => {
    return changeLog.filter((c) => entityFilter === '__all' ? true : c.entity === entityFilter);
  }, [changeLog, entityFilter]);

  const titleFor = (entity: string, id: string): string => {
    if (entity === 'goal') return goals.find((g) => g.id === id)?.title ?? id;
    if (entity === 'task') return tasks.find((t) => t.id === id)?.title ?? id;
    if (entity === 'habit') return habits.find((h) => h.id === id)?.title ?? id;
    return id;
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">История изменений</h1>
        <Select value={entityFilter} onValueChange={setEntityFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="__all">Все</SelectItem>
            <SelectItem value="goal">Цели</SelectItem>
            <SelectItem value="task">Задачи</SelectItem>
            <SelectItem value="habit">Привычки</SelectItem>
            <SelectItem value="progress">Прогресс</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 && (
        <Card>
          <div className="text-text-muted text-sm">Пока нет записей. История наполняется автоматически при изменении целей и значений.</div>
        </Card>
      )}

      <Card className="p-0">
        <div className="row-divide">
          {filtered.map((c) => (
            <div key={c.id} className="p-3 flex items-start gap-3 text-sm">
              <Badge tone="soft">{c.entity}</Badge>
              <div className="flex-1 min-w-0">
                <div className="truncate"><b>{titleFor(c.entity, c.entity_id)}</b> · поле <code>{c.field}</code></div>
                <div className="text-[11px] text-text-muted truncate">
                  {c.old_value !== null && <>было: <span className="text-text">{c.old_value}</span> → </>}
                  стало: <span className="text-accent">{c.new_value ?? '—'}</span>
                </div>
              </div>
              <div className="text-[11px] text-text-muted">{format(new Date(c.ts), 'd MMM HH:mm', { locale: ru })}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
