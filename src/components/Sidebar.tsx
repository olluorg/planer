import { NavLink } from 'react-router-dom';
import { LayoutGrid, Target, CheckSquare, HeartPulse, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

// Десктопный сайдбар убран (фокус-группа: «меню слева устарело»). Навигация теперь —
// раскрытие виджетов + меню у аватара в шапке + Ctrl+K. На мобильных оставляем нижнюю навигацию.
const mobileItems = [
  { to: '/', label: 'Главная', icon: LayoutGrid, end: true },
  { to: '/goals', label: 'Цели', icon: Target },
  { to: '/tasks', label: 'Задачи', icon: CheckSquare },
  { to: '/health', label: 'Здоровье', icon: HeartPulse },
];

export const Sidebar = () => {
  return (
    <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg border-t border-border flex py-1 safe-area-inset-bottom">
      {mobileItems.slice(0, 2).map((it) => (
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

      {mobileItems.slice(2).map((it) => (
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
  );
};
