import { toast } from './toast';

export function activityAction<T>(action: () => T): T | undefined {
  try { return action(); }
  catch (error) {
    toast.error('Активность не сохранена', String((error as Error)?.message ?? error));
    return undefined;
  }
}
