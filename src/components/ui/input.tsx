import * as React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...p }, ref) => (
    <input
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(
        'flex h-9 w-full rounded-lg border bg-bg-soft px-3 py-1 text-sm transition-colors',
        'placeholder:text-text-dim focus-visible:outline-none focus-visible:ring-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        error
          ? 'border-danger focus-visible:ring-danger/30'
          : 'border-border focus-visible:ring-accent/30 focus-visible:border-accent',
        className,
      )}
      {...p}
    />
  ),
);
Input.displayName = 'Input';

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...p }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-[80px] w-full rounded-lg border border-border bg-bg-soft px-3 py-2 text-sm',
        'placeholder:text-text-dim focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent',
        className,
      )}
      {...p}
    />
  ),
);
Textarea.displayName = 'Textarea';
