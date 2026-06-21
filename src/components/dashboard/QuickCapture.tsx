import { useState } from 'react';
import { useStore } from '@/lib/store';
import { isoDate } from '@/lib/utils';
import { toast } from '@/lib/toast';
import { CheckSquare, NotebookPen, Repeat, CornerDownLeft } from 'lucide-react';

type Mode = 'task' | 'note' | 'habit';

export const QuickCapture: React.FC<{ date: Date }> = ({ date }) => {
  const { addTask, addHabit } = useStore();
  const [mode, setMode] = useState<Mode>('task');
  const [text, setText] = useState('');

  const submit = () => {
    const v = text.trim();
    if (!v) return;
    if (mode === 'task') { addTask({ title: v, date: isoDate(date) }); toast.success('Задача добавлена'); }
    else if (mode === 'habit') { addHabit({ title: v }); toast.success('Привычка добавлена'); }
    else { addTask({ title: v, date: isoDate(date), notes: 'заметка' }); toast.success('Заметка сохранена'); }
    setText('');
  };

  const tabs: { id: Mode; label: string; icon: React.ElementType }[] = [
    { id: 'task', label: 'Задача', icon: CheckSquare },
    { id: 'note', label: 'Заметка', icon: NotebookPen },
    { id: 'habit', label: 'Привычка', icon: Repeat },
  ];

  return (
    <div className="rounded-xl bg-bg-card border border-border shadow-card p-4">
      <div className="flex items-center gap-1.5 text-label text-accent mb-3">
        <CheckSquare className="h-3.5 w-3.5" /> Быстрый захват
      </div>
      <div className="flex gap-1 mb-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setMode(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-colors ${
              mode === t.id ? 'bg-accent text-white' : 'bg-bg-soft text-text-muted hover:text-text'
            }`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>
      <div className="relative">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(); }}
          placeholder={mode === 'note' ? 'Что на уме?' : mode === 'habit' ? 'Новая привычка…' : 'Что нужно сделать?'}
          className="w-full h-20 rounded-lg border border-border-soft bg-bg-soft px-3 py-2 text-sm resize-none outline-none focus:border-accent transition-colors"
        />
      </div>
      <button
        onClick={submit}
        disabled={!text.trim()}
        className="mt-2 w-full h-9 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-soft disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
      >
        Добавить <CornerDownLeft className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};
