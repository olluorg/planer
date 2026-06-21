import * as React from 'react';
import { cn } from '@/lib/utils';

/**
 * Контейнер страницы по дизайн-системе THEDAD (Responsive Grid System v1.0).
 * Кодирует max-width и боковые поля по брейкпоинтам:
 *   LG 1025–1280 → max 1200, поля 32
 *   XL 1281–1536 → max 1280, поля 32
 *   2XL 1537+    → max 1440, поля 40
 *   MD и ниже    → 100%, поля 16–24 (fluid)
 */
export const PageContainer = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, ref) => (
    <div
      ref={ref}
      className={cn('page', className)}
      {...p}
    />
  ),
);
PageContainer.displayName = 'PageContainer';
