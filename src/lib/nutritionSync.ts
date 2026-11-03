/** Automatic sources own a health value only while it still matches what they wrote. */
export const NUTRITION_OWNER_KEY = 'nutrition.health-owner.v1';
export const WORKOUT_OWNER_KEY = 'workout.health-owner.v1';

export function releaseNutritionOwnership(): void {
  try { localStorage.removeItem(NUTRITION_OWNER_KEY); } catch { /* storage may be unavailable */ }
}

export function releaseWorkoutOwnership(): void {
  try { localStorage.removeItem(WORKOUT_OWNER_KEY); } catch { /* storage may be unavailable */ }
}

export function planOwnedHealthSync(current: number | undefined, previous: number | undefined, entries: number, total: number):
  | { action: 'write'; value: number }
  | { action: 'remove' }
  | { action: 'keep'; owned: boolean } {
  const owned = previous !== undefined && current === previous;
  if (entries === 0) return owned ? {action: 'remove'} : {action: 'keep', owned: false};
  if (current !== undefined && !owned) return {action: 'keep', owned: false};
  if (current === total) return {action: 'keep', owned: true};
  return {action: 'write', value: total};
}
