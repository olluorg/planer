import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Стандартная обёртка виджета дашборда.
 * Контракт размеров: карточка всегда заполняет ячейку сетки (h-full),
 * тело скроллится внутри (min-h-0 + overflow), контент не раздувает карточку.
 */
export interface WidgetCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Заголовок-метка (section label, uppercase) */
  title?: React.ReactNode;
  /** Действие справа от заголовка (ссылка, дропдаун, кнопка) */
  action?: React.ReactNode;
  /** Опциональный футер, прижат к низу карточки */
  footer?: React.ReactNode;
  /** Классы для тела (например, убрать скролл или паддинги) */
  bodyClassName?: string;
  /** Отключить внутренний скролл тела (контент обрезается) */
  noScroll?: boolean;
}

export const WidgetCard = React.forwardRef<HTMLDivElement, WidgetCardProps>(
  ({ title, action, footer, className, bodyClassName, noScroll, children, ...p }, ref) => (
    <div
      ref={ref}
      className={cn(
        'h-full flex flex-col rounded-xl bg-bg-card border border-border shadow-card overflow-hidden',
        'transition-shadow duration-base ease-standard hover:shadow-lift',
        className,
      )}
      {...p}
    >
      {(title || action) && (
        <div className="flex items-center justify-between gap-2 px-5 pt-4 shrink-0">
          {title ? <div className="text-label text-text-muted truncate">{title}</div> : <span />}
          {action && <div className="shrink-0 text-caption text-text-muted">{action}</div>}
        </div>
      )}
      <div
        className={cn(
          'flex-1 min-h-0 px-5 py-4',
          noScroll ? 'overflow-hidden' : 'overflow-y-auto',
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer && (
        <div className="shrink-0 px-5 py-3 border-t border-border-soft">{footer}</div>
      )}
    </div>
  ),
);
WidgetCard.displayName = 'WidgetCard';
