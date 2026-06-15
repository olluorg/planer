import { ChevronLeft, ChevronRight, CalendarIcon, Plus, Bell, Timer, Sun, Moon, Pause, Play, Square } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from './ui/button';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { useTheme } from '@/lib/theme';
import { GamificationBar } from './GamificationBar';
import { usePomodoroState, fmtSec } from '@/lib/pomodoroState';

interface Props {
  date: Date;
  onDate: (d: Date) => void;
  range: 'day' | 'week' | 'month' | 'year';
  onRange: (r: 'day' | 'week' | 'month' | 'year') => void;
  onAdd?: () => void;
  onTimer?: () => void;
  onBell?: () => void;
  bellCount?: number;
}

export const Topbar: React.FC<Props> = ({ date, onDate, range, onRange, onAdd, onTimer, onBell, bellCount = 0 }) => {
  const labelFull = format(date, 'd MMMM, EEEE', { locale: ru });
  const labelShort = format(date, 'd MMM', { locale: ru });
  const { theme, toggle } = useTheme();
  const pomo = usePomodoroState();
  return (
    <header className="shrink-0 border-b border-border">
      {/* Desktop */}
      <div className="hidden sm:flex items-center h-16 px-6 gap-4">
        <Tabs value={range} onValueChange={(v) => onRange(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Сегодня</TabsTrigger>
            <TabsTrigger value="week">Неделя</TabsTrigger>
            <TabsTrigger value="month">Месяц</TabsTrigger>
            <TabsTrigger value="year">Год</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex-1 flex items-center justify-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => onDate(addDays(date, -1))}><ChevronLeft /></Button>
          <div className="flex items-center gap-2 text-sm font-medium">
            <span>{labelFull}</span>
            <CalendarIcon className="h-4 w-4 text-text-muted" />
          </div>
          <Button variant="ghost" size="icon" onClick={() => onDate(addDays(date, 1))}><ChevronRight /></Button>
        </div>
        <div className="flex items-center gap-2">
          <GamificationBar />
          <Button variant="ghost" size="icon" onClick={onAdd} title="Добавить (Ctrl+K)"><Plus /></Button>
          {pomo.secondsLeft > 0 ? (
            <div className="flex items-center gap-1 border border-border px-2 py-1">
              <Timer className="h-3.5 w-3.5 text-text-muted" />
              <button onClick={onTimer} className="tabular-nums text-xs hover:text-accent" title={pomo.taskTitle ?? 'Свободный таймер'}>
                {fmtSec(pomo.secondsLeft)}
              </button>
              {pomo.running ? (
                <button onClick={() => pomo.pauseAction?.()} className="text-text-muted hover:text-text" title="Пауза">
                  <Pause className="h-3.5 w-3.5" />
                </button>
              ) : (
                <button onClick={() => pomo.resumeAction?.()} className="text-accent hover:text-accent-soft" title="Старт">
                  <Play className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={() => pomo.stopAction?.()} className="text-text-muted hover:text-danger" title="Стоп">
                <Square className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <Button variant="ghost" size="icon" onClick={onTimer} title="Таймер Pomodoro"><Timer /></Button>
          )}
          <Button variant="ghost" size="icon" onClick={onBell} title="Напоминания" className="relative">
            <Bell />
            {bellCount > 0 && (
              <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <div className="h-8 w-8 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">A</div>
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        <div className="flex items-center px-3 py-1.5 gap-2">
          <div className="flex flex-1 items-center gap-0.5">
            <Button variant="ghost" size="icon" onClick={() => onDate(addDays(date, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <span className="text-sm font-medium">{labelShort}</span>
            <Button variant="ghost" size="icon" onClick={() => onDate(addDays(date, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onAdd}><Plus className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onTimer}><Timer className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" onClick={onBell} className="relative">
              <Bell className="h-4 w-4" />
              {bellCount > 0 && <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-accent" />}
            </Button>
            <div className="h-7 w-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold">A</div>
          </div>
        </div>
        <div className="px-3 pb-2">
          <Tabs value={range} onValueChange={(v) => onRange(v as any)}>
            <TabsList className="flex w-full">
              <TabsTrigger value="day" className="flex-1">Сегодня</TabsTrigger>
              <TabsTrigger value="week" className="flex-1">Неделя</TabsTrigger>
              <TabsTrigger value="month" className="flex-1">Месяц</TabsTrigger>
              <TabsTrigger value="year" className="flex-1">Год</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </header>
  );
};
