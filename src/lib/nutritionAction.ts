import { toast } from './toast';

/** Оставляет форму открытой и сообщает об ошибке записи. */
export function nutritionAction<T>(action: () => T): T | undefined {
  try { return action(); }
  catch (error) {
    toast.error('Изменения питания не сохранены', String((error as Error)?.message ?? error));
    return undefined;
  }
}
