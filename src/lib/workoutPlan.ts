/** Keep explicitly paired sides together when a random workout is shortened. */
export function balanceWorkoutSides<T extends { name: string }>(shuffled: readonly T[], count: number): T[] {
  const plan = shuffled.slice(0, count);
  const pairs = [
    ['Боковая планка слева', 'Боковая планка справа'],
    ['Поза дерева (слева)', 'Поза дерева (справа)'],
  ] as const;
  const pairedNames = new Set<string>(pairs.flatMap(pair => [...pair]));
  for (const [left, right] of pairs) {
    const hasLeft = plan.some(item => item.name === left);
    const hasRight = plan.some(item => item.name === right);
    if (hasLeft === hasRight) continue;
    const missing = shuffled.find(item => item.name === (hasLeft ? right : left));
    let replaceAt = plan.length - 1;
    while (replaceAt >= 0 && pairedNames.has(plan[replaceAt].name)) replaceAt--;
    if (missing && replaceAt >= 0) plan[replaceAt] = missing;
  }
  return plan;
}
