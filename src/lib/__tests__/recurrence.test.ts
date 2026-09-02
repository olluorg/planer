import { describe, it, expect } from 'vitest';
import { nextRecurrenceDate } from '../recurrence';

describe('nextRecurrenceDate', () => {
  it('daily — следующий календарный день', () => {
    expect(nextRecurrenceDate('daily', '2026-03-10')).toBe('2026-03-11');
  });

  it('daily переходит через границу месяца и года', () => {
    expect(nextRecurrenceDate('daily', '2026-01-31')).toBe('2026-02-01');
    expect(nextRecurrenceDate('daily', '2026-12-31')).toBe('2027-01-01');
  });

  it('учитывает високосный год', () => {
    expect(nextRecurrenceDate('daily', '2028-02-28')).toBe('2028-02-29');
  });

  it('weekly — ровно +7 дней, тот же день недели', () => {
    const from = '2026-03-10'; // вторник
    const next = nextRecurrenceDate('weekly', from);
    expect(next).toBe('2026-03-17');
    expect(new Date(next + 'T00:00:00').getDay()).toBe(new Date(from + 'T00:00:00').getDay());
  });

  it('weekdays с пятницы перескакивает выходные на понедельник', () => {
    expect(nextRecurrenceDate('weekdays', '2026-03-13')).toBe('2026-03-16');
  });

  it('weekends с субботы даёт воскресенье, с воскресенья — субботу', () => {
    expect(nextRecurrenceDate('weekends', '2026-03-14')).toBe('2026-03-15');
    expect(nextRecurrenceDate('weekends', '2026-03-15')).toBe('2026-03-21');
  });

  it('всегда возвращает дату строго позже исходной', () => {
    const rules = ['daily', 'weekdays', 'weekends', 'weekly'] as const;
    for (const rule of rules) {
      for (let d = 1; d <= 28; d++) {
        const from = `2026-04-${String(d).padStart(2, '0')}`;
        expect(nextRecurrenceDate(rule, from) > from).toBe(true);
      }
    }
  });

  it('результат всегда валидная дата в формате YYYY-MM-DD', () => {
    const next = nextRecurrenceDate('weekdays', '2026-02-27');
    expect(next).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(next))).toBe(false);
  });
});
