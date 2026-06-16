const DONE_KEY = 'onboarding.done.v1';
const NAME_KEY = 'user.name.v1';
const CATEGORIES_KEY = 'user.categories.v1';

export function isOnboardingDone(): boolean {
  return localStorage.getItem(DONE_KEY) === '1';
}
export function setOnboardingDone(v = true) {
  if (v) localStorage.setItem(DONE_KEY, '1');
  else localStorage.removeItem(DONE_KEY);
}

export function getUserName(): string {
  return localStorage.getItem(NAME_KEY) || 'друг';
}
export function setUserName(name: string) {
  if (name.trim()) localStorage.setItem(NAME_KEY, name.trim());
}

export function getUserCategories(): string[] {
  try {
    const raw = localStorage.getItem(CATEGORIES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
export function setUserCategories(cats: string[]) {
  localStorage.setItem(CATEGORIES_KEY, JSON.stringify(cats));
}

export const CATEGORIES = [
  { id: 'health',    label: 'Здоровье',  icon: '💪', sample: { title: 'Тренировка 3 раза в неделю', type: 'mid', target: 12, unit: 'трен' } },
  { id: 'career',    label: 'Карьера',   icon: '🚀', sample: { title: 'Запуск проекта', type: 'long', target: 100, unit: '%' } },
  { id: 'finance',   label: 'Финансы',   icon: '💰', sample: { title: 'Финансовая подушка', type: 'long', target: 300000, unit: '₽' } },
  { id: 'learning',  label: 'Обучение',  icon: '📚', sample: { title: 'Прочитать 12 книг в год', type: 'long', target: 12, unit: 'книг' } },
  { id: 'family',    label: 'Семья',     icon: '👨‍👩‍👧', sample: { title: 'Время с близкими еженедельно', type: 'mid', target: 4, unit: 'ч' } },
  { id: 'hobby',     label: 'Хобби',     icon: '🎨', sample: { title: 'Регулярно заниматься хобби', type: 'mid', target: 50, unit: 'ч' } },
] as const;
