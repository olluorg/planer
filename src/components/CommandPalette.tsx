import { useEffect, useState } from 'react';
import { Command } from 'cmdk';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid, Target, CheckSquare, Repeat, Calendar, BarChart3, NotebookPen, Settings,
  Plus, Search, Moon, Sun, Download, Crosshair, Keyboard,
} from 'lucide-react';
import { useStore } from '@/lib/store';
import { useTheme } from '@/lib/theme';

export const CommandPalette: React.FC<{
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAddTask: () => void;
  onAddHabit: () => void;
  onAddGoal: () => void;
  onAddProgress: () => void;
  onFocusMode?: () => void;
  onShortcuts?: () => void;
}> = ({ open, onOpenChange, onAddTask, onAddHabit, onAddGoal, onAddProgress, onFocusMode, onShortcuts }) => {
  const nav = useNavigate();
  const { goals, tasks, habits } = useStore();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState('');

  useEffect(() => {
    if (open) setQ('');
  }, [open]);

  const close = () => onOpenChange(false);
  const go = (path: string) => { nav(path); close(); };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Палитра команд"
      className="fixed inset-0 z-[100] flex items-start justify-center pt-20 bg-black/50 backdrop-blur-sm animate-fade-in"
      contentClassName="w-full max-w-xl border border-border bg-bg-card shadow-2xl outline-none animate-slide-up"
    >
      <div className="flex items-center gap-2 border-b border-border px-3">
        <Search className="h-4 w-4 text-text-muted" />
        <Command.Input
          value={q}
          onValueChange={setQ}
          placeholder="Поиск команд, целей, задач..."
          className="flex-1 h-11 bg-transparent outline-none text-sm placeholder:text-text-dim"
        />
        <kbd className="text-[10px] text-text-dim border border-border px-1.5 py-0.5">esc</kbd>
      </div>
      <Command.List className="max-h-[60vh] overflow-auto p-2">
        <Command.Empty className="p-6 text-center text-sm text-text-muted">Ничего не найдено</Command.Empty>

        <Command.Group heading="Действия" className="text-[11px] uppercase tracking-wider text-text-muted px-2 py-1">
          <Item icon={Plus} label="Новая задача" shortcut="T" onSelect={() => { close(); onAddTask(); }} />
          <Item icon={Plus} label="Новая привычка" shortcut="H" onSelect={() => { close(); onAddHabit(); }} />
          <Item icon={Plus} label="Новая цель" shortcut="G" onSelect={() => { close(); onAddGoal(); }} />
          <Item icon={Plus} label="Записать показатель" shortcut="P" onSelect={() => { close(); onAddProgress(); }} />
          {onFocusMode && <Item icon={Crosshair} label="Focus Mode (Deep Work)" shortcut="⇧F" onSelect={() => { close(); onFocusMode(); }} />}
          {onShortcuts && <Item icon={Keyboard} label="Горячие клавиши" shortcut="?" onSelect={() => { close(); onShortcuts(); }} />}
          <Item icon={theme === 'dark' ? Sun : Moon} label={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'} onSelect={() => { toggle(); close(); }} />
        </Command.Group>

        <Command.Group heading="Переход" className="text-[11px] uppercase tracking-wider text-text-muted px-2 py-1 mt-2">
          <Item icon={LayoutGrid} label="Главная" onSelect={() => go('/')} />
          <Item icon={Target} label="Цели" onSelect={() => go('/goals')} />
          <Item icon={CheckSquare} label="Задачи" onSelect={() => go('/tasks')} />
          <Item icon={Repeat} label="Привычки" onSelect={() => go('/habits')} />
          <Item icon={Calendar} label="План" onSelect={() => go('/plan')} />
          <Item icon={BarChart3} label="Аналитика" onSelect={() => go('/analytics')} />
          <Item icon={NotebookPen} label="Рефлексия" onSelect={() => go('/reflection')} />
          <Item icon={Settings} label="Настройки" onSelect={() => go('/settings')} />
        </Command.Group>

        {goals.length > 0 && (
          <Command.Group heading="Цели" className="text-[11px] uppercase tracking-wider text-text-muted px-2 py-1 mt-2">
            {goals.map((g) => (
              <Item key={g.id} icon={Target} label={g.title} keywords={[g.title]} onSelect={() => go('/goals')} />
            ))}
          </Command.Group>
        )}

        {tasks.length > 0 && (
          <Command.Group heading="Задачи" className="text-[11px] uppercase tracking-wider text-text-muted px-2 py-1 mt-2">
            {tasks.slice(0, 30).map((t) => (
              <Item key={t.id} icon={CheckSquare} label={t.title} keywords={[t.title]} onSelect={() => go('/tasks')} />
            ))}
          </Command.Group>
        )}

        {habits.length > 0 && (
          <Command.Group heading="Привычки" className="text-[11px] uppercase tracking-wider text-text-muted px-2 py-1 mt-2">
            {habits.map((h) => (
              <Item key={h.id} icon={Repeat} label={h.title} keywords={[h.title]} onSelect={() => go('/habits')} />
            ))}
          </Command.Group>
        )}
      </Command.List>
    </Command.Dialog>
  );
};

const Item: React.FC<{
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  shortcut?: string;
  keywords?: string[];
  onSelect: () => void;
}> = ({ icon: Icon, label, shortcut, keywords, onSelect }) => (
  <Command.Item
    onSelect={onSelect}
    keywords={keywords}
    className="flex items-center gap-3 px-2 py-2 text-sm cursor-pointer aria-selected:bg-bg-hover data-[selected=true]:bg-bg-hover"
  >
    <Icon className="h-4 w-4 text-text-muted" />
    <span className="flex-1">{label}</span>
    {shortcut && <kbd className="text-[10px] text-text-dim border border-border px-1.5 py-0.5">{shortcut}</kbd>}
  </Command.Item>
);
