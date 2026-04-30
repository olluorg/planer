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
      'peer h-5 w-5 shrink-0 border transition-all duration-200',
      'border-[rgba(255,255,255,0.15)] bg-transparent',
      'focus-visible:outline-none',
      'data-[state=checked]:bg-accent data-[state=checked]:border-accent',
      'data-[state=checked]:shadow-[0_0_0_1px_rgba(132,204,22,0.5),0_0_14px_rgba(132,204,22,0.35)]',
      'hover:border-accent/50',
      'animate-[check-pop_220ms_ease]',
      className,
    )}
    style={{ borderRadius: '4px' }}
    {...props}
  >
    <RC.Indicator className="flex items-center justify-center">
      <Check className="h-3 w-3 text-black" strokeWidth={3} />
    </RC.Indicator>
  </RC.Root>
));
Checkbox.displayName = 'Checkbox';
