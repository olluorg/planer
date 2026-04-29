// Utilities for Chrome extension context detection and chrome.storage access.
// All functions are safe to call outside extension context (no-op or return fallback).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cr = () => (globalThis as any).chrome;

export const isExtension: boolean =
  typeof globalThis !== 'undefined' &&
  typeof cr() !== 'undefined' &&
  !!cr()?.runtime?.id;

export async function getExtSetting<T>(key: string, fallback: T): Promise<T> {
  if (!isExtension) return fallback;
  const result = await cr().storage.local.get(key);
  return (result[key] as T) ?? fallback;
}

export async function setExtSetting(key: string, value: unknown): Promise<void> {
  if (!isExtension) return;
  await cr().storage.local.set({ [key]: value });
  // notify background to reschedule alarms if needed
  cr().runtime.sendMessage({ type: 'reschedule' }).catch(() => {});
}

export function syncTasksToExtension(
  tasks: Array<{ status: string; date: string; time_block: string | null; title: string; id: string }>,
): void {
  if (!isExtension) return;
  void cr().storage.local.set({ planer_tasks: tasks.filter((t) => t.status === 'active') });
}
