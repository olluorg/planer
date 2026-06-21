import { Search, Plus, Bell, Timer, Sun, Moon, Pause, Play, Square, Crosshair, Lightbulb, CheckSquare, NotebookPen, Target, Zap } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme } from '@/lib/theme';
import { usePomodoroState, fmtSec } from '@/lib/pomodoroState';

interface Props {
  onAdd?: () => void;
  onAddNote?: () => void;
  onAddGoal?: () => void;
  onTimer?: () => void;
  onBell?: () => void;
  onFocusMode?: () => void;
  onInsights?: () => void;
  onPalette?: () => void;
  bellCount?: number;
}

export const Topbar: React.FC<Props> = ({ onAdd, onAddNote, onAddGoal, onTimer, onBell, onFocusMode, onInsights, onPalette, bellCount = 0 }) => {
  const { theme, toggle } = useTheme();
  const pomo = usePomodoroState();

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
          className="flex-1 max-w-xl flex items-center gap-2.5 h-10 rounded-xl bg-bg-soft border border-border-soft px-3.5 text-text-muted hover:border-border transition-colors"
        >
          <Search className="h-4 w-4 shrink-0" />
          <span className="text-sm truncate">Поиск или команда…</span>
          <kbd className="ml-auto hidden sm:flex items-center gap-0.5 text-[10px] text-text-dim border border-border-soft rounded-md px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </button>

        <div className="flex-1 hidden lg:block" />

        {/* Pomodoro chip */}
        {pomo.secondsLeft > 0 && (
          <div className="flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/30 px-2.5 h-9">
            <Timer className="h-3.5 w-3.5 text-accent" />
            <button onClick={onTimer} className="tabular-nums text-xs font-medium text-accent" title={pomo.taskTitle ?? 'Свободный таймер'}>
              {fmtSec(pomo.secondsLeft)}
            </button>
            {pomo.running ? (
              <button onClick={() => pomo.pauseAction?.()} className="text-accent/70 hover:text-accent" title="Пауза"><Pause className="h-3.5 w-3.5" /></button>
            ) : (
              <button onClick={() => pomo.resumeAction?.()} className="text-accent hover:text-accent-soft" title="Старт"><Play className="h-3.5 w-3.5" /></button>
            )}
            <button onClick={() => pomo.stopAction?.()} className="text-accent/70 hover:text-danger" title="Стоп"><Square className="h-3.5 w-3.5" /></button>
          </div>
        )}

        {/* Action icons */}
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" onClick={onAdd} title="Добавить"><Plus /></Button>
          <Button variant="ghost" size="icon" onClick={onFocusMode} title="Focus Mode (Ctrl+Shift+F)" className="hidden sm:inline-flex"><Crosshair /></Button>
          <Button variant="ghost" size="icon" onClick={onInsights} title="Инсайты (Ctrl+I)" className="hidden sm:inline-flex"><Lightbulb /></Button>
          <Button variant="ghost" size="icon" onClick={onBell} title="Уведомления" className="relative">
            <Bell />
            {bellCount > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-bg" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Quick actions row */}
      <div className="hidden md:flex items-center gap-1 px-4 sm:px-6 pb-2 -mt-1">
        {quickActions.map((a) => (
          <button
            key={a.label}
            onClick={a.onClick}
            className="group flex items-center gap-2 h-8 px-3 rounded-lg text-sm text-text-muted hover:bg-bg-soft hover:text-text transition-colors"
          >
            <a.icon className="h-4 w-4" />
            <span>{a.label}</span>
            <kbd className="text-[10px] text-text-dim border border-border-soft rounded px-1 opacity-0 group-hover:opacity-100 transition-opacity">{a.kbd}</kbd>
          </button>
        ))}
      </div>
    </header>
  );
};
