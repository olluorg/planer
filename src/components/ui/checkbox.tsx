import * as React from 'react';
import * as RC from '@radix-ui/react-checkbox';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof RC.Root>,
  React.ComponentPropsWithoutRef<typeof RC.Root>
>(({ className, ...props }, ref) => (
  <RC.Root
    ref={ref}
    className={cn(
      'peer h-6 w-6 shrink-0 border border-border bg-bg-soft transition-colors',
      'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
      'data-[state=checked]:bg-accent data-[state=checked]:border-accent data-[state=checked]:text-black',
      className,
    )}
    {...props}
  >
    <RC.Indicator className="flex items-center justify-center animate-check-pop">
      <Check className="h-4 w-4" strokeWidth={3} />
    </RC.Indicator>
  </RC.Root>
));
Checkbox.displayName = 'Checkbox';
