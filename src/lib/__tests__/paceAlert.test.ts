// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import { assessPace, duePaceAlerts, paceMessage } from '../paceAlert';
import type { Goal, ProgressRecord } from '../types';

const goal = (o: Partial<Goal> = {}): Goal => ({
  id: 'g', parent_id: null, title: 'Бег', type: 'mid', metric: null,
  start_value: 0, target_value: 100, current_value: 0, unit: 'км', deadline: '2026-10-31',
  status: 'active', color: null, cover: null, health_metric: null, created_at: 'x', updated_at: 'x', ...o,
});
const rec = (date: string, value: number, goal_id = 'g'): ProgressRecord => ({ id: date + goal_id, goal_id, date, value, note: null });
const TODAY = '2026-10-01';

describe('оценка темпа', () => {
  it('успевающая цель не тревожит', () => {
    // 3 км/день, осталось 50 км за 30 дней → к сроку 140, с запасом
    expect(assessPace(goal(), [rec('2026-09-21', 20), rec('2026-10-01', 50)], TODAY)).toBeNull();
  });

  it('отстающая цель даёт три честные цифры', () => {
    // 1 км/день, осталось 60 км за 30 дней → к сроку будет 70
    const v = assessPace(goal(), [rec('2026-09-21', 30), rec('2026-10-01', 40)], TODAY)!;
    expect(v.daysLeft).toBe(30);
    expect(v.velocity).toBeCloseTo(1, 5);
    expect(v.required).toBeCloseTo(2, 5);      // нужно 2 км/день
    expect(v.reachable).toBeCloseTo(70, 5);    // уменьшить цель до 70
    expect(v.eta).toBe('2026-11-30');          // или сдвинуть срок: 60 дней
  });

  it('движение в обратную сторону — срок сдвигать бессмысленно', () => {
    const v = assessPace(goal(), [rec('2026-09-21', 40), rec('2026-10-01', 30)], TODAY)!;
    expect(v.eta).toBeNull();
    expect(paceMessage(v).body).toMatch(/Сдвинуть срок не поможет/);
  });

  it('убывающая цель (похудение) считается в правильную сторону', () => {
    const g = goal({ title: 'Вес', start_value: 90, target_value: 80, unit: 'кг' });
    // −0,1 кг/день, осталось −8 кг за 30 дней → к сроку 85
    const v = assessPace(g, [rec('2026-09-21', 89), rec('2026-10-01', 88)], TODAY)!;
    expect(v.required).toBeCloseTo(-8 / 30, 5);
    expect(v.reachable).toBeCloseTo(85, 5);
    expect(paceMessage(v).body).toMatch(/0,27 кг в день вместо 0,1 кг в день/);
  });

  it('молчит, когда судить не по чему или поздно', () => {
    expect(assessPace(goal(), [rec('2026-10-01', 10)], TODAY)).toBeNull();                        // одна отметка
    expect(assessPace(goal(), [rec('2026-10-01', 10), rec('2026-10-01', 12)], TODAY)).toBeNull(); // один день
    expect(assessPace(goal({ deadline: null }), [rec('2026-09-21', 1), rec('2026-10-01', 2)], TODAY)).toBeNull();
    expect(assessPace(goal({ deadline: '2026-09-30' }), [rec('2026-09-21', 1), rec('2026-10-01', 2)], TODAY)).toBeNull();
    expect(assessPace(goal({ status: 'archived' }), [rec('2026-09-21', 1), rec('2026-10-01', 2)], TODAY)).toBeNull();
    expect(assessPace(goal(), [rec('2026-09-21', 90), rec('2026-10-01', 100)], TODAY)).toBeNull(); // уже достигнута
  });

  it('отставание в пределах 2% пути — шум, не повод', () => {
    // 1,3 км/день: 60 + 30 × 1,3 = 99 из 100 — недобор 1% пути
    expect(assessPace(goal(), [rec('2026-09-21', 47), rec('2026-10-01', 60)], TODAY)).toBeNull();
    // а 3% — уже повод: 60 + 30 × 1,23 ≈ 97
    expect(assessPace(goal(), [rec('2026-09-21', 47.7), rec('2026-10-01', 60)], TODAY)).not.toBeNull();
  });

  it('чужие отметки не смешиваются', () => {
    const recs = [rec('2026-09-21', 30), rec('2026-10-01', 40), rec('2026-09-21', 0, 'other'), rec('2026-10-01', 99, 'other')];
    expect(assessPace(goal(), recs, TODAY)!.velocity).toBeCloseTo(1, 5);
  });
});

describe('когда показывать', () => {
  beforeEach(() => localStorage.clear());
  const behind = [rec('2026-09-21', 30), rec('2026-10-01', 40)];

  it('предупреждает не чаще раза в неделю на цель', () => {
    const now = Date.parse('2026-10-01T12:00:00');
    expect(duePaceAlerts([goal()], behind, now, TODAY)).toHaveLength(1);
    expect(duePaceAlerts([goal()], behind, now + 3 * 86_400_000, TODAY)).toHaveLength(0);
    expect(duePaceAlerts([goal()], behind, now + 8 * 86_400_000, TODAY)).toHaveLength(1);
  });
});
