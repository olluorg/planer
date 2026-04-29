import * as React from 'react';
import { cn } from '@/lib/utils';

export const Badge: React.FC<React.HTMLAttributes<HTMLSpanElement> & { tone?: 'default' | 'accent' | 'warn' | 'danger' | 'info' | 'soft' }> = ({
  className,
  tone = 'default',
  ...p
}) => {
  const map = {
    default: 'bg-bg-soft text-text-muted',
    accent: 'bg-accent/15 text-accent',
    warn: 'bg-warn/15 text-warn',
    danger: 'bg-danger/15 text-danger',
    info: 'bg-info/15 text-info',
    soft: 'bg-bg-hover text-text',
  } as const;
  return <span className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium', map[tone], className)} {...p} />;
};
