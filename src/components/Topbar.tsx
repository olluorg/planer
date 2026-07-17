import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Bell, Sun, Moon, Crosshair, Settings, Trophy, LayoutTemplate, History, ChevronDown, Download, Share } from 'lucide-react';
import { Button } from './ui/button';
import { useTheme, isDarkMode } from '@/lib/theme';
import { Logo } from './ui/logo';
import { getUserName } from '@/lib/onboarding';
import { GoogleIcon, openGoogleSearch } from './ui/google-icon';
import { usePwaInstall, promptInstall } from '@/lib/pwa';
import { toast } from '@/lib/toast';

interface Props {
  onAdd?: () => void;
  onBell?: () => void;
  onFocusMode?: () => void;
  onInsights?: () => void;
  /** Открыть палитру команд, опционально с уже введённым запросом. */
  onPalette?: (query?: string) => void;
  bellCount?: number;
}

// Служебные страницы теперь живут в меню у аватара (сайдбар убран). Открываются модалкой.
const UTILITY = [
  { page: 'settings', label: 'Настройки', icon: Settings },
  { page: 'awards', label: 'Награды', icon: Trophy },
  { page: 'templates', label: 'Шаблоны', icon: LayoutTemplate },
  { page: 'history', label: 'История', icon: History },
] as const;

const openPage = (page: string) => window.dispatchEvent(new CustomEvent('thedad:expand', { detail: { page } }));

/** Меню-замена сайдбара: аватар → служебные страницы. */
const AppMenu: React.FC = () => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { canInstall, iosHint, standalone } = usePwaInstall();
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg pl-1 pr-1.5 h-9 hover:bg-bg-soft transition-colors"
        title={getUserName()}
      >
        <span className="h-7 w-7 rounded-full bg-gradient-to-br from-accent to-accent-soft text-white flex items-center justify-center text-xs font-bold shrink-0">
          {getUserName().slice(0, 1).toUpperCase()}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-text-dim" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-52 rounded-xl bg-bg-card border border-border shadow-card p-1.5 animate-[slide-up_140ms_ease-out]">
          <div className="px-2.5 py-1.5 text-[13px] font-semibold text-text truncate">{getUserName()}</div>
          <div className="my-1 border-t border-border-soft" />
          {UTILITY.map((it) => (
            <button
              key={it.page}
              onClick={() => { openPage(it.page); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-text-muted hover:bg-bg-soft hover:text-text transition-colors"
            >
              <it.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
              <span>{it.label}</span>
            </button>
          ))}

          {/* Установка приложения на устройство (PWA), пока не установлено */}
          {!standalone && (canInstall || iosHint) && (
            <>
              <div className="my-1 border-t border-border-soft" />
              {canInstall ? (
                <button
                  onClick={async () => { setOpen(false); if (!(await promptInstall())) toast.info('Установку можно запустить позже из этого меню'); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-accent hover:bg-accent/10 transition-colors"
                >
                  <Download className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>Установить приложение</span>
                </button>
              ) : (
                <button
                  onClick={() => { setOpen(false); toast.info('Установка на iPhone', 'Нажми «Поделиться» → «На экран Домой»'); }}
                  className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[13px] text-accent hover:bg-accent/10 transition-colors"
                >
                  <Share className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>Добавить на экран «Домой»</span>
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export const Topbar: React.FC<Props> = ({ onAdd, onBell, onFocusMode, onPalette, bellCount = 0 }) => {
  const { theme, toggle } = useTheme();
  const nav = useNavigate();
  const [searchQ, setSearchQ] = useState('');
  // Клик по логотипу/названию — на главную; заодно закрываем раскрытый виджет-страницу
  const goHome = () => {
    window.dispatchEvent(new CustomEvent('thedad:expand', { detail: { page: null } }));
    nav('/');
  };

  return (
    // z-40: в glass-темах backdrop-filter делает header отдельным stacking context,
    // без z-index меню аватара рисовалось ПОД виджетами сетки (у них transform)
    <header className="relative z-40 shrink-0 border-b border-border-soft">
      <div className="flex items-center h-16 px-4 sm:px-6 gap-2 sm:gap-3">
        {/* Бренд — клик ведёт на главную + единственная точка входа в Фокус */}
        <button onClick={goHome} className="flex items-center gap-2 shrink-0 rounded-lg px-1 -mx-1 hover:bg-bg-soft transition-colors" title="На главную">
          <Logo size={30} className="shrink-0" />
          <span className="hidden md:block text-[15px] font-bold text-text">THEDAD</span>
        </button>
        <Button variant="soft" size="sm" onClick={onFocusMode} className="shrink-0 gap-1.5" title="Focus Mode (Ctrl+Shift+F)">
          <Crosshair className="h-4 w-4" /> <span className="hidden sm:inline">Фокус</span>
        </Button>

        {/* Search: настоящее поле ввода. Enter — поиск по приложению (палитра),
            значок Google — тот же запрос во внешний поиск */}
        <div className="flex-1 min-w-0 flex items-center gap-2.5 h-10 rounded-xl bg-bg-soft border border-border-soft px-3.5 text-text-muted focus-within:border-border transition-colors">
          <Search className="h-4 w-4 shrink-0" />
          <input
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { onPalette?.(searchQ); setSearchQ(''); }
              if (e.key === 'Escape') setSearchQ('');
            }}
            placeholder="Поиск или команда…"
            className="flex-1 min-w-0 bg-transparent outline-none text-sm text-text placeholder:text-text-muted"
          />
          {searchQ.trim() && (
            <>
              <button
                onClick={() => { onPalette?.(searchQ); setSearchQ(''); }}
                className="hidden sm:block text-[11px] text-text-dim hover:text-text shrink-0 transition-colors"
                title="Искать в приложении (Enter)"
              >
                Enter — в приложении
              </button>
              <button
                onClick={() => { openGoogleSearch(searchQ); setSearchQ(''); }}
                className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0 hover:bg-bg-hover transition-colors"
                title={`Искать «${searchQ.trim()}» в Google`}
              >
                <GoogleIcon className="h-4 w-4" />
              </button>
            </>
          )}
          {!searchQ.trim() && (
            <button
              onClick={() => onPalette?.()}
              className="ml-auto hidden sm:flex items-center gap-0.5 text-[10px] text-text-dim border border-border-soft rounded-md px-1.5 py-0.5 hover:text-text transition-colors shrink-0"
              title="Палитра команд"
            >
              Ctrl K
            </button>
          )}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" onClick={onAdd} title="Добавить"><Plus /></Button>
          <Button variant="ghost" size="icon" onClick={onBell} title="Уведомления и инсайты" className="relative">
            <Bell />
            {bellCount > 0 && <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-danger ring-2 ring-bg" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggle} title={isDarkMode(theme) ? 'Светлый режим' : 'Тёмный режим'}>
            {isDarkMode(theme) ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <AppMenu />
        </div>
      </div>
    </header>
  );
};
