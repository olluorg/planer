import { NavLink } from 'react-router-dom';
import { LayoutGrid, Target, CheckSquare, Repeat, Calendar, BarChart3, NotebookPen, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const items = [
  { to: '/', label: 'Главная', icon: LayoutGrid, end: true },
  { to: '/goals', label: 'Цели', icon: Target },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare },
  { to: '/habits', label: 'Привычки', icon: Repeat },
  { to: '/plan', label: 'План', icon: Calendar },
  { to: '/analytics', label: 'Аналитика', icon: BarChart3 },
  { to: '/reflection', label: 'Рефлексия', icon: NotebookPen },
  { to: '/settings', label: 'Настройки', icon: Settings },
];

export const Sidebar = () => (
  <aside className="w-[88px] shrink-0 border-r border-border bg-bg-card flex flex-col">
    <div className="h-16 flex items-center justify-center border-b border-border">
      <div className="text-[15px] font-bold tracking-wider">REFORM</div>
    </div>
    <nav className="flex-1 py-4 flex flex-col gap-1 px-2">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn(
              'flex flex-col items-center justify-center gap-1 py-3 rounded-md text-[11px] transition-colors',
              isActive ? 'bg-bg-hover text-text' : 'text-text-muted hover:bg-bg-soft hover:text-text',
            )
          }
        >
          <it.icon className="h-5 w-5" strokeWidth={1.5} />
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  </aside>
);
