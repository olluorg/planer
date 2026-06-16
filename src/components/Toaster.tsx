import { useToastStore, type ToastKind } from '@/lib/toast';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ICON: Record<ToastKind, React.ReactNode> = {
  success: <CheckCircle2 className="h-5 w-5 text-success" />,
  error: <XCircle className="h-5 w-5 text-danger" />,
  info: <Info className="h-5 w-5 text-info" />,
};

const BAR: Record<ToastKind, string> = {
  success: '#22c55e',
  error: '#ef4444',
  info: '#3b82f6',
};

export const Toaster: React.FC = () => {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[360px] max-w-[92vw] pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-xl bg-bg-card border border-border-soft shadow-card overflow-hidden animate-toast-in"
          style={{ borderLeft: `3px solid ${BAR[t.kind]}` }}
        >
          <div className="flex items-start gap-3 p-3.5">
            <div className="shrink-0 mt-0.5">{ICON[t.kind]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-text leading-snug">{t.message}</div>
              {t.description && <div className="text-xs text-text-muted mt-0.5 leading-relaxed">{t.description}</div>}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              className="shrink-0 h-6 w-6 rounded-md hover:bg-bg-soft flex items-center justify-center text-text-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
