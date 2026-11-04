export interface HubPhotos { before?: string; after?: string }

export function readHubPhotos(key: string): HubPhotos {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '{}');
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.entries(value).some(([name, image]) => !['before', 'after'].includes(name) || typeof image !== 'string' || !/^data:image\/(?:png|jpeg|webp);base64,/i.test(image))) throw new Error('invalid');
    return value as HubPhotos;
  } catch { throw new Error('Фото программы повреждены или недоступны. Данные не изменены; восстановите резервную копию.'); }
}

export function readHubGoals(key: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? '[]');
    if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) throw new Error('invalid');
    return value;
  } catch { throw new Error('Отметки целей повреждены или недоступны. Данные не изменены; восстановите резервную копию.'); }
}
