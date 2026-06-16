import { useState } from 'react';
import { Sun, Sunset, Moon, MoreHorizontal, Check, Plus, Pencil, ChevronRight } from 'lucide-react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

const BLOCKS = [
  { key: 'morning', label: 'Утро', range: '06:00 – 12:00', icon: Sun, tone: '#facc15', bg: '#fff8e1' },
  { key: 'day',     label: 'День',  range: '12:00 – 18:00', icon: Sun, tone: '#60a5fa', bg: '#e0f0ff' },
  { key: 'evening', label: 'Вечер', range: '18:00 – 22:00', icon: Sunset, tone: '#fb923c', bg: '#ffedd5' },
  { key: 'night',   label: 'Ночь',  range: '22:00 – 06:00', icon: Moon, tone: '#6366f1', bg: '#ece4ff' },
] as const;

const TASK_BG: Record<string, string> = {
  morning: 'rgba(254, 240, 199, 0.65)',
  day:     'rgba(207, 232, 255, 0.7)',
  evening: 'rgba(255, 228, 207, 0.7)',
  night:   'rgba(228, 219, 255, 0.7)',
};

interface Props { date: Date }

export const TodayPlan: React.FC<Props> = ({ date }) => {
  const { tasks, toggleTask } = useStore();
  const today = isoDate(date);
  const dayTasks = tasks.filter((t) => t.date === today && !t.parent_id);
  const [tab, setTab] = useState<'day' | 'week'>('day');
  const nav = useNavigate();

  return (
    <div className="rounded-2xl bg-bg-card border border-border-soft shadow-soft p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-text">Сегодняшний план</h3>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-bg-soft p-0.5 flex">
            <button
              onClick={() => setTab('day')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${tab === 'day' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
            >День</button>
            <button
              onClick={() => setTab('week')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${tab === 'week' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
            >Неделя</button>
          </div>
          <Button variant="ghost" size="sm" onClick={() => nav('/plan')}>
            <Pencil className="h-3.5 w-3.5" /> Изменить план
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {BLOCKS.map((b) => {
          const list = dayTasks.filter((t) => t.time_block === b.key);
          return (
            <div key={b.key} className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg flex items-center justify-center" style={{ background: b.bg }}>
                  <b.icon className="h-4 w-4" style={{ color: b.tone }} />
                </div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-text">{b.label}</div>
                  <div className="text-[11px] text-text-muted">{b.range}</div>
                </div>
              </div>
              {list.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl px-3 py-2.5 flex items-center gap-2.5 transition-all hover:shadow-soft"
                  style={{ background: TASK_BG[b.key] }}
                >
                  <button
                    onClick={() => toggleTask(t.id)}
                    className={`h-5 w-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${
                      t.status === 'done'
                        ? 'border-violet-500 bg-violet-500 text-white'
                        : 'border-slate-300 bg-white/80'
                    }`}
                  >
                    {t.status === 'done' && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${t.status === 'done' ? 'line-through text-slate-500' : 'text-slate-800'}`}>
                      {t.title}
                    </div>
                    {t.start_time && (
                      <div className="text-[11px] text-slate-500 tabular-nums mt-0.5">{t.start_time}</div>
                    )}
                  </div>
                  <button className="text-slate-400 hover:text-slate-600 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => nav('/tasks')}
                className="w-full rounded-xl border border-dashed border-border px-3 py-2 text-xs text-text-muted hover:bg-bg-soft transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" /> Добавить задачу
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
