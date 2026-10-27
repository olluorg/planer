import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { MoreHorizontal, ChevronDown } from 'lucide-react';

const closeExpandedPage = () => window.dispatchEvent(new CustomEvent('thedad:expand', { detail: { page: null } }));
const more = [
  ['/plan', 'План дня'], ['/calendar', 'Календарь'], ['/habits', 'Привычки'],
  ['/health', 'Здоровье'], ['/analytics', 'Аналитика'], ['/reflection', 'Рефлексия'],
  ['/templates', 'Шаблоны'], ['/history', 'История'], ['/awards', 'Награды'], ['/settings', 'Настройки'],
];

export function MoreNavigation({ mobile = false }: { mobile?: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (menu.current && !menu.current.contains(event.target as Node)) menu.current.open = false;
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && menu.current?.open) {
        menu.current.open = false;
        menu.current.querySelector('summary')?.focus();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, []);
  return (
    <details ref={menu} className={mobile ? 'relative flex-1 group' : 'relative group'}>
      <summary className={mobile
        ? 'list-none cursor-pointer flex flex-col items-center justify-center gap-0.5 min-h-12 text-[10px] text-text-muted rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'
        : 'list-none cursor-pointer flex items-center gap-1 min-h-10 px-3 text-sm rounded-lg text-text-muted hover:bg-bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent'}>
        {mobile && <MoreHorizontal className="h-5 w-5" />}
        Ещё {!mobile && <ChevronDown className="h-3.5 w-3.5" />}
      </summary>
      <div className={`absolute right-0 z-50 w-52 max-h-[65dvh] overflow-auto rounded-xl border border-border modal-surface bg-bg-card p-1.5 shadow-card ${mobile ? 'bottom-full mb-3' : 'top-full mt-1'}`}>
        {more.map(([to, title]) => (
          <NavLink key={to} to={to} onClick={(e) => {
            e.currentTarget.closest('details')?.removeAttribute('open');
            closeExpandedPage();
          }} className={({ isActive }) => `flex min-h-11 items-center rounded-lg px-3 text-sm transition-colors ${isActive ? 'bg-accent/10 text-accent font-medium' : 'text-text hover:bg-bg-soft'}`}>
            {title}
          </NavLink>
        ))}
      </div>
    </details>
  );
}

export function AppNavigation() {
  return (
    <nav aria-label="Основные разделы" className="hidden sm:flex items-center gap-1 px-5 pb-2">
      {[[ '/', 'Сегодня'], ['/tasks', 'Задачи'], ['/goals', 'Цели'], ['/calendar', 'Календарь']].map(([to, title]) => (
        <NavLink key={to} to={to} end={to === '/'} onClick={closeExpandedPage}
          className={({ isActive }) => `flex items-center min-h-10 px-3 rounded-lg text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${isActive ? 'bg-accent/10 text-accent font-semibold' : 'text-text-muted hover:bg-bg-soft hover:text-text'}`}>
          {title}
        </NavLink>
      ))}
      <MoreNavigation />
    </nav>
  );
}
