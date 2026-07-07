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
      'peer h-5 w-5 shrink-0 rounded-full border-2 transition-colors duration-150',
      'border-text-dim bg-transparent',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40',
      'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
      'hover:border-accent',
      className,
    )}
    {...props}
  >
    <RC.Indicator className="flex items-center justify-center animate-check-pop">
      <Check className="h-3 w-3 text-white" strokeWidth={3} />
    </RC.Indicator>
  </RC.Root>
));
Checkbox.displayName = 'Checkbox';
