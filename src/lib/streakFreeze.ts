// Streak-freeze: 1 freeze regenerates per calendar month.
// Used freezes are stored per-date so computeStreak can mark inactive days as still-counting.

const FREEZE_USED_KEY = 'streak.freezes.used.v1';
const FREEZE_GRANT_KEY = 'streak.freezes.granted_for_month.v1';

export const FREEZES_PER_MONTH = 1;

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function loadGrantedMonths(): string[] {
  try {
    const raw = localStorage.getItem(FREEZE_GRANT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveGrantedMonths(arr: string[]) {
  localStorage.setItem(FREEZE_GRANT_KEY, JSON.stringify(arr));
}

export function loadUsedFreezes(): string[] {
  try {
    const raw = localStorage.getItem(FREEZE_USED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveUsedFreezes(arr: string[]) {
  localStorage.setItem(FREEZE_USED_KEY, JSON.stringify(arr));
}

export function availableFreezes(today = new Date()): number {
  const granted = loadGrantedMonths();
  const used = loadUsedFreezes();
  const cur = monthKey(today);
  const monthsKnown = granted.filter((m) => m === cur).length;
  // ensure this month is granted
  if (monthsKnown === 0) {
    saveGrantedMonths([...granted, cur]);
  }
  const usedThisMonth = used.filter((d) => d.startsWith(cur)).length;
  return Math.max(0, FREEZES_PER_MONTH - usedThisMonth);
}

export function useFreeze(date: string): boolean {
  const used = loadUsedFreezes();
  if (used.includes(date)) return true;
  const target = new Date(date);
  if (availableFreezes(target) <= 0) return false;
  saveUsedFreezes([...used, date]);
  return true;
}

export function isFreezeUsed(date: string): boolean {
  return loadUsedFreezes().includes(date);
}
