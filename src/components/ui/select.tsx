import * as React from 'react';
import * as RS from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Select = RS.Root;
export const SelectValue = RS.Value;

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof RS.Trigger>,
  React.ComponentPropsWithoutRef<typeof RS.Trigger>
>(({ className, children, ...props }, ref) => (
  <RS.Trigger
    ref={ref}
    className={cn(
      'flex h-9 w-full items-center justify-between rounded-md border border-border bg-bg-soft px-3 py-2 text-sm',
      'focus:outline-none focus:ring-1 focus:ring-accent data-[placeholder]:text-text-dim',
      className,
    )}
    {...props}
  >
    {children}
    <RS.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </RS.Icon>
  </RS.Trigger>
));
SelectTrigger.displayName = 'SelectTrigger';

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof RS.Content>,
  React.ComponentPropsWithoutRef<typeof RS.Content>
>(({ className, children, ...props }, ref) => (
  <RS.Portal>
    <RS.Content
      ref={ref}
      position="popper"
      sideOffset={4}
      className={cn(
        'z-50 min-w-[8rem] overflow-hidden rounded-md border border-border bg-bg-card text-text shadow-md animate-fade-in',
        className,
      )}
      {...props}
    >
      <RS.Viewport className="p-1">{children}</RS.Viewport>
    </RS.Content>
  </RS.Portal>
));
SelectContent.displayName = 'SelectContent';

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof RS.Item>,
  React.ComponentPropsWithoutRef<typeof RS.Item>
>(({ className, children, ...props }, ref) => (
  <RS.Item
    ref={ref}
    className={cn(
      'relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none',
      'focus:bg-bg-hover data-[disabled]:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <RS.ItemIndicator>
        <Check className="h-4 w-4" />
      </RS.ItemIndicator>
    </span>
    <RS.ItemText>{children}</RS.ItemText>
  </RS.Item>
));
SelectItem.displayName = 'SelectItem';
