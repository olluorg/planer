import * as React from 'react';
import * as RD from '@radix-ui/react-dialog';
import { cn } from '@/lib/utils';

export const Sheet = RD.Root;
export const SheetTrigger = RD.Trigger;
export const SheetClose = RD.Close;

/**
 * Bottom sheet: на мобильных выезжает снизу, на десктопе центрируется как обычный диалог.
 */
export const SheetContent = React.forwardRef<
  React.ElementRef<typeof RD.Content>,
  React.ComponentPropsWithoutRef<typeof RD.Content> & { title?: string }
>(({ className, children, title, ...props }, ref) => (
  <RD.Portal>
    <RD.Overlay className="fixed inset-0 z-[120] bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0" />
    <RD.Content
      ref={ref}
      className={cn(
        'fixed z-[130] bg-bg-card border border-border-soft shadow-card outline-none',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 duration-300 ease-emphasized',
        // mobile: bottom sheet
        'inset-x-0 bottom-0 rounded-t-2xl max-h-[90vh] overflow-y-auto',
        'max-sm:data-[state=open]:slide-in-from-bottom-full max-sm:data-[state=closed]:slide-out-to-bottom-full',
        // desktop: centered modal, spring-like scale+fade
        'sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md sm:rounded-2xl sm:max-h-[85vh]',
        'sm:data-[state=open]:zoom-in-95 sm:data-[state=closed]:zoom-out-95 sm:data-[state=open]:slide-in-from-left-1/2 sm:data-[state=open]:slide-in-from-top-[48%] sm:data-[state=closed]:slide-out-to-left-1/2 sm:data-[state=closed]:slide-out-to-top-[48%]',
        className,
      )}
      {...props}
    >
      {/* drag handle on mobile */}
      <div className="sm:hidden flex justify-center pt-2.5 pb-1">
        <div className="h-1 w-10 rounded-full bg-border" />
      </div>
      {title && (
        <RD.Title className="px-5 pt-2 pb-3 text-base font-semibold text-text">{title}</RD.Title>
      )}
      {!title && <RD.Title className="sr-only">Панель</RD.Title>}
      <div className="px-5 pb-6 sm:pt-3">{children}</div>
    </RD.Content>
  </RD.Portal>
));
SheetContent.displayName = 'SheetContent';
