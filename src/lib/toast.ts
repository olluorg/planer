import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export interface ToastAction { label: string; onClick: () => void }

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  description?: string;
  duration: number;
  action?: ToastAction;
}

interface ToastState {
  toasts: Toast[];
  push: (t: Omit<Toast, 'id' | 'duration'> & { id?: string; duration?: number }) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = t.id ?? Math.random().toString(36).slice(2, 10);
    const duration = t.duration ?? 3200;
    set((s) => ({ toasts: [...s.toasts, { id, kind: t.kind, message: t.message, description: t.description, duration, action: t.action }] }));
    if (duration > 0) {
      window.setTimeout(() => get().dismiss(id), duration);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })),
}));

// Удобный helper для вызова из любого места (вне React).
export const toast = {
  success: (message: string, description?: string) => useToastStore.getState().push({ kind: 'success', message, description }),
  error: (message: string, description?: string) => useToastStore.getState().push({ kind: 'error', message, description }),
  info: (message: string, description?: string) => useToastStore.getState().push({ kind: 'info', message, description }),
  /** Тост с кнопкой действия (например «Отменить»). Дольше живёт по умолчанию. */
  action: (message: string, action: ToastAction, opts?: { description?: string; duration?: number }) =>
    useToastStore.getState().push({ kind: 'info', message, description: opts?.description, action, duration: opts?.duration ?? 6000 }),
};
