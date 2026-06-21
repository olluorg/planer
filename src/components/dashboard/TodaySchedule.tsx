import { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import type { Task } from '@/lib/types';

interface Props { date: Date }

const COLORS = ['#a78bfa', '#60a5fa', '#34d399', '#fb923c', '#f472b6', '#facc15'];

export const TodaySchedule: React.FC<Props> = ({ date }) => {
  const { tasks } = useStore();
  const today = isoDate(date);
  const nav = useNavigate();

  const scheduled = useMemo(() => {
    return tasks
      .filter((t) => t.date === today && t.start_time && !t.parent_id)
      .sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? ''));
  }, [tasks, today]);

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text">Расписание на сегодня</h3>
        <Button variant="ghost" size="sm" onClick={() => nav('/plan')}>Все события</Button>
      </div>
      {scheduled.length === 0 ? (
        <div className="text-xs text-text-muted">Нет событий с конкретным временем.</div>
      ) : (
        <div className="space-y-1.5">
          {scheduled.slice(0, 6).map((t, i) => (
            <ScheduleRow key={t.id} task={t} color={COLORS[i % COLORS.length]} />
          ))}
        </div>
      )}
    </div>
  );
};

const ScheduleRow: React.FC<{ task: Task; color: string }> = ({ task, color }) => {
  const start = task.start_time ?? '';
  const end = task.estimate_min ? plus(start, task.estimate_min) : '';
  return (
    <div className="flex items-stretch gap-3">
      <div className="text-[11px] text-text-muted tabular-nums w-12 text-right pt-3 leading-tight">
        <div>{start}</div>
        {end && <div className="text-text-dim">{end}</div>}
      </div>
      <div className="flex items-start gap-2 flex-1">
        <div className="h-2 w-2 rounded-full mt-3.5 shrink-0" style={{ background: color }} />
        <div
          className="flex-1 rounded-xl px-3 py-2.5 text-sm"
          style={{ background: `${color}1f`, color: '#0f172a' }}
        >
          <div className="font-semibold leading-snug truncate">{task.title}</div>
          {task.notes && <div className="text-[11px] text-slate-500 truncate mt-0.5">{task.notes}</div>}
        </div>
      </div>
    </div>
  );
};

function plus(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return '';
  const total = h * 60 + m + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}
