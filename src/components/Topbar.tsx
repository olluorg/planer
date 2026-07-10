import { Search, Plus, Bell, Sun, Moon, Crosshair, Lightbulb, CheckSquare, NotebookPen, Target, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme, isDarkMode } from '@/lib/theme';

interface Props {
  onAdd?: () => void;
  onAddNote?: () => void;
  onAddGoal?: () => void;
  onBell?: () => void;
  onFocusMode?: () => void;
  onInsights?: () => void;
  onPalette?: () => void;
  bellCount?: number;
}

export const Topbar: React.FC<Props> = ({ onAdd, onAddNote, onAddGoal, onBell, onFocusMode, onInsights, onPalette, bellCount = 0 }) => {
  const { theme, toggle } = useTheme();

  const quickActions = [
    { icon: CheckSquare, label: 'Задача', kbd: 'T', onClick: onAdd },
    { icon: NotebookPen, label: 'Заметка', kbd: 'N', onClick: onAddNote },
    { icon: Crosshair, label: 'Фокус', kbd: 'F', onClick: onFocusMode },
    { icon: Target, label: 'Цель', kbd: 'G', onClick: onAddGoal },
    { icon: Zap, label: 'Захват', kbd: 'Q', onClick: onAdd },
  ];

  return (
    <header className="shrink-0 border-b border-border-soft">
      <div className="flex items-center h-16 px-4 sm:px-6 gap-3">
        {/* Search / command */}
        <button
          onClick={onPalette}
          className="flex-1 flex items-center gap-2.5 h-10 rounded-xl bg-bg-soft border border-border-soft px-3.5 text-text-muted hover:border-border transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="text-sm truncate">Поиск или команда…</span>
          <kbd className="ml-auto hidden sm:flex items-center gap-0.5 text-[10px] text-text-dim border border-border-soft rounded-md px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </button>

        {/* Action icons */}
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={onAdd} title="Добавить"><Plus /></Button>
          <Button variant="ghost" size="icon" onClick={onFocusMode} title="Focus Mode (Ctrl+Shift+F)" className="hidden sm:inline-flex"><Crosshair /></Button>
          <Button variant="ghost" size="icon" onClick={onInsights} title="Инсайты (Ctrl+I)" className="hidden sm:inline-flex"><Lightbulb /></Button>
          <Button variant="ghost" size="icon" onClick={onBell} title="Уведомления" className="relative">
            <Bell />
            {bellCount > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-bg" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} title={isDarkMode(theme) ? 'Светлый режим' : 'Тёмный режим'}>
            {isDarkMode(theme) ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Quick actions row */}
      <div className="hidden md:flex items-center gap-1.5 px-4 sm:px-6 pb-2.5 -mt-0.5">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="flex items-center gap-2 h-8 px-3 rounded-lg text-sm text-text-muted hover:bg-bg-soft hover:text-text transition-colors duration-base"
          >
            <a.icon className="h-4 w-4" />
            <span>{a.label}</span>
            <kbd className="text-[10px] leading-none text-text-dim border border-border rounded px-1 py-0.5 bg-bg-card">{a.kbd}</kbd>
          </button>
        ))}
      </div>
    </header>
  );
};
