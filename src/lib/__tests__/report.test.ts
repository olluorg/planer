import { describe, it, expect } from 'vitest';
import { buildWeeklyMarkdown } from '../report';
import type { Task } from '../types';

describe('недельный отчёт', () => {
  it('задачи попадают в свой день, а не в соседний', () => {
    // Регрессия: полночь понедельника переводилась в UTC, и в Москве неделя
    // отчёта начиналась с воскресенья.
    const t = { id: '1', title: 'Понедельничная', date: '2026-09-21', status: 'done', parent_id: null } as Task;
    const md = buildWeeklyMarkdown(new Date(2026, 8, 23), { goals: [], tasks: [t], habits: [], habitLogs: [], progress: [], reflections: [] });
    expect(md).toMatch(/Задач выполнено: \*\*1 \/ 1\*\*/);
    const monday = md.split('### ')[1];
    expect(monday).toMatch(/^понедельник, 21 сент/);
    expect(monday).toMatch(/Задачи: 1\/1/);
  });
});
