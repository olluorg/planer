import { NavLink } from 'react-router-dom';
import { LayoutGrid, Target, CheckSquare, Repeat, Calendar, CalendarDays, BarChart3, NotebookPen, Settings, History, ChevronRight, Trophy, Sparkles, LayoutTemplate, Plus, Crosshair, Play, HeartPulse } from 'lucide-react';
import { cn, isoDate } from '@/lib/utils';
import { useStore } from '@/lib/store';
import { useMemo } from 'react';
import { getUserName } from '@/lib/onboarding';
import { quoteOfDay } from '@/lib/quotes';

const items = [
  { to: '/', label: 'Главная', icon: LayoutGrid, end: true },
  { to: '/goals', label: 'Цели', icon: Target },
  { to: '/plan', label: 'План', icon: Calendar },
  { to: '/calendar', label: 'Календарь', icon: CalendarDays },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare },
  { to: '/habits', label: 'Привычки', icon: Repeat },
  { to: '/health', label: 'Здоровье', icon: HeartPulse },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/reflection', label: 'Рефлексия', icon: NotebookPen },
  { to: '/awards', label: 'Награды', icon: Trophy },
  { to: '/templates', label: 'Шаблоны', icon: LayoutTemplate },
];

export const Sidebar = () => {
  const { tasks } = useStore();

  const focusTask = useMemo(() => {
    const today = isoDate(new Date());
    const list = tasks.filter((t) => t.date === today && t.status === 'active' && !t.parent_id);
    list.sort((a, b) => a.priority - b.priority);
    return list[0] ?? null;
  }, [tasks]);

  const todayCounts = useMemo(() => {
    const today = isoDate(new Date());
    const dt = tasks.filter((t) => t.date === today && !t.parent_id);
    return { done: dt.filter((t) => t.status === 'done').length, total: dt.length };
  }, [tasks]);

  const quote = quoteOfDay();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex w-[210px] shrink-0 border-r border-border flex-col bg-bg-card">
        {/* Brand */}
        <div className="px-5 py-5 border-b border-border-soft shrink-0 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-accent text-white flex items-center justify-center shrink-0 shadow-lift">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-bold text-text">THEDAD</div>
            <div className="text-[11px] text-text-muted">Планер целей</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 flex flex-col gap-1 px-3 overflow-y-auto">
          {items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all',
                  isActive
                    ? 'bg-accent text-white shadow-lift'
                    : 'text-text-muted hover:bg-bg-soft hover:text-text',
                )
              }
            >
              <it.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>{it.label}</span>
            </NavLink>
          ))}
          <div className="my-2 border-t border-border-soft" />
          <NavLink
            to="/history"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all',
                isActive ? 'bg-accent text-white shadow-lift' : 'text-text-muted hover:bg-bg-soft hover:text-text',
              )
            }
          >
            <History className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>История</span>
          </NavLink>
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2 text-[13px] font-medium rounded-lg transition-all',
                isActive ? 'bg-accent text-white shadow-lift' : 'text-text-muted hover:bg-bg-soft hover:text-text',
              )
            }
          >
            <Settings className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span>Настройки</span>
          </NavLink>
        </nav>

        {/* Focus of the day */}
        <div className="px-3 pb-3 pt-2 shrink-0 space-y-2">
          {focusTask && (
            <div
              className="rounded-xl p-3 shadow-lift"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-soft))', color: 'white' }}
            >
              <div className="text-[10px] uppercase tracking-wider opacity-80">Фокус дня</div>
              <div className="text-sm font-semibold leading-snug mt-1 line-clamp-2">{focusTask.title}</div>
              {todayCounts.total > 0 && (
                <>
                  <div className="text-[11px] opacity-80 mt-2">{todayCounts.done} / {todayCounts.total} задач выполнено</div>
                  <div className="h-1 bg-white/25 rounded-full overflow-hidden mt-1.5">
                    <div className="h-full bg-white/90 transition-all" style={{ width: `${todayCounts.total ? (todayCounts.done / todayCounts.total) * 100 : 0}%` }} />
                  </div>
                </>
              )}
            </div>
          )}
          {/* Мотивация дня */}
          <div className="rounded-xl bg-bg-soft p-3">
            <div className="text-[10px] uppercase tracking-wider text-text-muted mb-1">Мотивация дня</div>
            <div className="text-[12px] text-text leading-snug">«{quote.text}»</div>
          </div>
          {/* Focus Mode */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('thedad:focus-mode'))}
            className="w-full flex items-center gap-3 rounded-xl bg-bg-soft hover:bg-bg-hover p-3 transition-colors group"
          >
            <div className="h-9 w-9 rounded-lg bg-accent/15 flex items-center justify-center shrink-0">
              <Crosshair className="h-4 w-4 text-accent" />
            </div>
            <div className="flex-1 min-w-0 text-left leading-tight">
              <div className="text-[13px] font-semibold text-text">Focus Mode</div>
              <div className="text-[10px] text-text-muted">Deep Work · 45 мин</div>
            </div>
            <div className="h-7 w-7 rounded-full bg-accent text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Play className="h-3.5 w-3.5" fill="white" />
            </div>
          </button>
          {/* User */}
          <NavLink
            to="/settings"
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-bg-soft transition-colors"
          >
            <div className="h-9 w-9 rounded-full bg-gradient-to-br from-accent to-accent-soft text-white flex items-center justify-center text-sm font-bold shrink-0 shadow-sm">
              {getUserName().slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0 leading-tight">
              <div className="text-[13px] font-semibold text-text truncate">{getUserName()}</div>
              <div className="text-[10px] text-text-muted">Pro версия</div>
            </div>
            <ChevronRight className="h-4 w-4 text-text-dim shrink-0" />
          </NavLink>
        </div>
      </aside>

      {/* Mobile bottom navigation — 5 items max to prevent squishing */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-border flex py-1 safe-area-inset-bottom">
        {[items[0], items[1]].map((it) => (
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

        {/* Central FAB — quick capture */}
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('thedad:quick-capture'))}
          className="flex-1 flex items-center justify-center"
          aria-label="Быстрое добавление"
        >
          <span className="h-11 w-11 -mt-5 rounded-full bg-accent text-white flex items-center justify-center shadow-lift">
            <Plus className="h-6 w-6" />
          </span>
        </button>

        {[items[4], items[6]].map((it) => (
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
