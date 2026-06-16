import * as React from 'react';
import { cn } from '@/lib/utils';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...p }, ref) => (
    <div
      ref={ref}
      className={cn(
        'p-5 rounded-xl bg-bg-card border border-border-soft shadow-soft hover:shadow-card transition-shadow',
        className,
      )}
      {...p}
    />
  ),
);
Card.displayName = 'Card';

export const CardTitle = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('label-up mb-3', className)} {...p} />
);
