import { Plus, CalendarPlus, FileText, BarChart3 } from 'lucide-react';

interface Props {
  onAddTask: () => void;
  onScheduleEvent: () => void;
  onAddNote: () => void;
  onAddProgress: () => void;
}

export const QuickActions: React.FC<Props> = ({ onAddTask, onScheduleEvent, onAddNote, onAddProgress }) => {
  const items = [
    { l: 'Добавить задачу', icon: Plus,         onClick: onAddTask },
    { l: 'Запланировать событие', icon: CalendarPlus, onClick: onScheduleEvent },
    { l: 'Новая заметка',   icon: FileText,     onClick: onAddNote },
    { l: 'Записать рефлексию', icon: BarChart3, onClick: onAddProgress },
  ];
  return (
    <div className="rounded-2xl bg-bg-card border border-border-soft shadow-soft p-5">
      <h3 className="text-base font-semibold text-text mb-3">Быстрые действия</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {items.map((q) => (
          <button
            key={q.l}
            onClick={q.onClick}
            className="rounded-xl border border-border-soft hover:border-accent hover:shadow-soft transition-all p-3 flex flex-col items-center gap-2 group"
          >
            <div className="h-9 w-9 rounded-xl bg-bg-soft group-hover:bg-accent/10 flex items-center justify-center transition-colors">
              <q.icon className="h-4 w-4 text-text-muted group-hover:text-accent transition-colors" />
            </div>
            <span className="text-[11px] text-text-muted group-hover:text-text text-center leading-tight">{q.l}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
