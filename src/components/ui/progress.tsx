import * as React from 'react';
import { cn } from '@/lib/utils';

export const Progress: React.FC<{
  value: number;
  className?: string;
  barClassName?: string;
  barColor?: string;
}> = ({ value, className, barClassName, barColor }) => (
  <div className={cn('h-1.5 w-full overflow-hidden bg-bg-soft', className)}>
    <div
      className={cn('h-full transition-all duration-300', barColor ? '' : 'bg-accent', barClassName)}
      style={{
        width: `${Math.max(0, Math.min(100, value))}%`,
        ...(barColor ? { background: barColor } : {}),
      }}
    />
  </div>
);
