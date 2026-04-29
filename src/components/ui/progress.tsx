import * as React from 'react';
import { cn } from '@/lib/utils';

export const Progress: React.FC<{ value: number; className?: string; barClassName?: string }> = ({
  value,
  className,
  barClassName,
}) => (
  <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-bg-soft', className)}>
    <div
      className={cn('h-full bg-accent transition-all duration-300', barClassName)}
      style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
    />
  </div>
);
