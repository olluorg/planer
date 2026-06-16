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
    <RD.Overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm animate-fade-in" />
    <RD.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-bg-card border border-border-soft shadow-card p-6',
        // mobile: bottom sheet
        'inset-x-0 bottom-0 rounded-t-2xl max-h-[92vh] overflow-y-auto sheet-up',
        // desktop: centered modal
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:max-h-[85vh] sm:animate-slide-up',
        className,
      )}
      {...props}
    >
      {/* drag handle on mobile */}
      <div className="sm:hidden flex justify-center -mt-2 mb-3">
        <div className="h-1 w-10 rounded-full bg-border" />
      </div>
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
