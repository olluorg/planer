import { useMemo, useState } from 'react';
import { Card, CardTitle } from '@/components/ui/card';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { useStore } from '@/lib/store';
import { format } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';

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

  const STAGE_LABEL: Record<string, string> = { todo: 'To do', doing: 'В работе', done: 'Готово' };

  // Человекочитаемое описание события задачи + акцент (цвет)
  const taskEvent = (c: typeof changeLog[number]): { title: string; phrase: string; tone: 'accent' | 'good' | 'muted' | 'danger' } => {
    if (c.field === 'deleted') return { title: c.old_value ?? c.entity_id, phrase: 'удалена', tone: 'danger' };
    const title = titleFor('task', c.entity_id);
    if (c.field === 'created') return { title, phrase: 'создана', tone: 'accent' };
    if (c.field === 'status') return c.new_value === 'done'
      ? { title, phrase: 'выполнена', tone: 'good' }
      : { title, phrase: 'возобновлена', tone: 'muted' };
    if (c.field === 'stage') return {
      title,
      phrase: `${STAGE_LABEL[c.old_value ?? ''] ?? c.old_value ?? '—'} → ${STAGE_LABEL[c.new_value ?? ''] ?? c.new_value ?? '—'}`,
      tone: 'accent',
    };
    return { title, phrase: c.field, tone: 'muted' };
  };
  const TONE_CLASS = { accent: 'text-accent', good: 'text-success', muted: 'text-text-muted', danger: 'text-danger' } as const;

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-h1">История изменений</h1>
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

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            emoji="📜"
            title="История пуста"
            description="Записи появляются автоматически при изменении целей и значений прогресса."
          />
        </Card>
      ) : (
      <Card className="p-0">
        <div className="row-divide">
          {filtered.map((c) => (
            <div key={c.id} className="p-3 flex items-start gap-3 text-sm">
              <Badge tone="soft">{c.entity}</Badge>
              {c.entity === 'task' ? (() => {
                const ev = taskEvent(c);
                return (
                  <div className="flex-1 min-w-0">
                    <div className="truncate"><b>{ev.title}</b></div>
                    <div className={`text-[11px] ${TONE_CLASS[ev.tone]} truncate`}>{ev.phrase}</div>
                  </div>
                );
              })() : (
                <div className="flex-1 min-w-0">
                  <div className="truncate"><b>{titleFor(c.entity, c.entity_id)}</b> · поле <code>{c.field}</code></div>
                  <div className="text-[11px] text-text-muted truncate">
                    {c.old_value !== null && <>было: <span className="text-text">{c.old_value}</span> → </>}
                    стало: <span className="text-accent">{c.new_value ?? '—'}</span>
                  </div>
                </div>
              )}
              <div className="text-[11px] text-text-muted">{format(new Date(c.ts), 'd MMM HH:mm', { locale: ru })}</div>
            </div>
          ))}
        </div>
      </Card>
      )}
    </div>
  );
};
