import * as React from 'react';
import * as RT from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

export const Tabs = RT.Root;

export const TabsList = React.forwardRef<
  React.ElementRef<typeof RT.List>,
  React.ComponentPropsWithoutRef<typeof RT.List>
>(({ className, ...p }, ref) => (
  <RT.List ref={ref} className={cn('inline-flex h-9 items-center gap-1 rounded-md bg-bg-soft p-1', className)} {...p} />
));
TabsList.displayName = 'TabsList';

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof RT.Trigger>,
  React.ComponentPropsWithoutRef<typeof RT.Trigger>
>(({ className, ...p }, ref) => (
  <RT.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-sm font-medium text-text-muted transition-all',
      'data-[state=active]:bg-bg-card data-[state=active]:text-text data-[state=active]:shadow',
      className,
    )}
    {...p}
  />
));
TabsTrigger.displayName = 'TabsTrigger';

export const TabsContent = RT.Content;
