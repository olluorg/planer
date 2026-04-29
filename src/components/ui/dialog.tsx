import * as React from 'react';
import * as RD from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = RD.Root;
export const DialogTrigger = RD.Trigger;
export const DialogClose = RD.Close;

export const DialogContent = React.forwardRef<
  React.ElementRef<typeof RD.Content>,
  React.ComponentPropsWithoutRef<typeof RD.Content>
>(({ className, children, ...props }, ref) => (
  <RD.Portal>
    <RD.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm animate-fade-in" />
    <RD.Content
      ref={ref}
      className={cn(
        'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
        'card p-6 shadow-2xl animate-slide-up',
        className,
      )}
      {...props}
    >
      {children}
      <RD.Close className="absolute right-4 top-4 text-text-muted hover:text-text">
        <X className="h-4 w-4" />
      </RD.Close>
    </RD.Content>
  </RD.Portal>
));
DialogContent.displayName = 'DialogContent';

export const DialogHeader = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mb-4', className)} {...p} />
);
export const DialogTitle = ({ className, ...p }: React.HTMLAttributes<HTMLHeadingElement>) => (
  <RD.Title className={cn('text-lg font-semibold', className)} {...p} />
);
export const DialogDescription = ({ className, ...p }: React.HTMLAttributes<HTMLParagraphElement>) => (
  <RD.Description className={cn('text-sm text-text-muted mt-1', className)} {...p} />
);
export const DialogFooter = ({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex justify-end gap-2 mt-6', className)} {...p} />
);
