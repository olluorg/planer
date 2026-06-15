import { NavLink } from 'react-router-dom';
import { LayoutGrid, Target, CheckSquare, Repeat, Calendar, BarChart3, NotebookPen, Settings, History, Flame, ChevronRight, Trophy } from 'lucide-react';
import { cn, isoDate } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useMemo } from 'react';
import { subDays } from 'date-fns';

const items = [
  { to: '/', label: 'Главная', icon: LayoutGrid, end: true },
  { to: '/goals', label: 'Цели', icon: Target },
  { to: '/plan', label: 'План', icon: Calendar },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare },
  { to: '/habits', label: 'Привычки', icon: Repeat },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/reflection', label: 'Рефлексия', icon: NotebookPen },
  { to: '/awards', label: 'Награды', icon: Trophy },
];

const XP_PER_TASK = 50;
const XP_PER_LEVEL = 3000;

export const Sidebar = () => {
  const { tasks, habitLogs } = useStore();

  const { streak, xp, level } = useMemo(() => {
    const today = isoDate(new Date());
    let s = 0;
    for (let i = 0; i < 365; i++) {
      const d = isoDate(subDays(new Date(), i));
      const hasDone = tasks.some((t) => t.date === d && t.status === 'done') ||
        habitLogs.some((l) => l.date === d && l.done);
      if (!hasDone) break;
      s++;
    }
    const totalDone = tasks.filter((t) => t.status === 'done').length;
    const totalXP = totalDone * XP_PER_TASK;
    const lvl = Math.floor(totalXP / XP_PER_LEVEL) + 1;
    const xpInLevel = totalXP % XP_PER_LEVEL;
    return { streak: s, xp: xpInLevel, level: lvl };
  }, [tasks, habitLogs]);

  const xpPct = Math.round((xp / XP_PER_LEVEL) * 100);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-[140px] shrink-0 border-r border-border flex-col bg-bg-card">
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-4 border-b border-border shrink-0">
          <Flame className="h-5 w-5 text-accent shrink-0" />
          <span className="text-[14px] font-bold tracking-widest text-text uppercase">thedad</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-2 flex flex-col gap-px px-2 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 px-2.5 py-2 text-[12px] font-medium transition-all',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-text-muted hover:bg-bg-hover hover:text-text',
                )
              }
            >
              <it.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              <span>{it.label}</span>
            </NavLink>
          ))}
          <div className="my-1 border-t border-border/50" />
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-2.5 py-2 text-[12px] font-medium transition-all',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text',
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>Настройки</span>
          </NavLink>
          <NavLink
            to="/history"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2.5 px-2.5 py-2 text-[12px] font-medium transition-all',
                isActive
                  ? 'bg-accent/15 text-accent'
                  : 'text-text-muted hover:bg-bg-hover hover:text-text',
              )
            }
          >
            <History className="h-4 w-4 shrink-0" strokeWidth={1.5} />
            <span>История</span>
          </NavLink>
        </nav>

        {/* Streak + XP */}
        <div className="px-3 py-3 border-t border-border space-y-2 shrink-0 bg-bg-soft/30">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-orange-400 shrink-0" />
            <div>
              <div className="text-sm font-bold text-text leading-none">{streak}</div>
              <div className="text-[10px] text-text-muted">дней подряд</div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-text-muted">Ур. {level}</span>
              <span className="text-text-dim tabular-nums">{xp.toLocaleString()} / {XP_PER_LEVEL.toLocaleString()} XP</span>
            </div>
            <div className="h-1.5 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent transition-all duration-500"
                style={{ width: `${xpPct}%` }}
              />
            </div>
          </div>
          {/* Profile */}
          <NavLink
            to="/settings"
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="h-7 w-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-bold shrink-0">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-text truncate">Профиль</div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-text-dim shrink-0" />
          </NavLink>
        </div>
      </aside>

      {/* Mobile bottom navigation — 5 items max to prevent squishing */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-border flex py-1 safe-area-inset-bottom">
        {[items[0], items[1], items[3], items[4], items[6]].map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            end={it.end}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] transition-colors',
                isActive ? 'text-accent' : 'text-text-muted',
              )
            }
          >
            <it.icon className="h-5 w-5 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{it.label}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );
};
