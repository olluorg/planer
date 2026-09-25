import { describe, it, expect } from 'vitest';
import { parseImportFile, applyImport, ImportFormatError, type ImportedTask } from '../importers';

// Образцы повторяют структуру выгрузок каждого сервиса: названия колонок,
// служебные строки, коды приоритетов и статусов.
const TODOIST = '﻿' + [
  'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE,DURATION,DURATION_UNIT',
  'section,Работа,,,,,,,,,,',
  'task,Отчёт за квартал,"Собрать цифры, ""свести"" таблицу",4,1,Аня (1),,2026-10-05,en,Europe/Moscow,,',
  'task,Цифры продаж,,1,2,Аня (1),,,en,Europe/Moscow,,',
  'note,Комментарий к задаче,,,,,,,,,,',
  'task,Зарядка,,1,1,Аня (1),,every day,en,Europe/Moscow,,',
  'task,Созвон,,3,1,Аня (1),,2026-10-06 15:30,en,Europe/Moscow,,',
  'task,Что-то,,2,1,Аня (1),,next tuesday at noon,en,Europe/Moscow,,',
].join('\n');

const TICKTICK = [
  '"Date: 2026-09-25+0000"',
  '"Version: 7.1"',
  '"Status: ',
  '0 Normal',
  '1 Completed',
  '2 Archived"',
  '"Folder Name","List Name","Title","Kind","Tags","Content","Is Check list","Start Date","Due Date","Reminder","Repeat","Priority","Status","Created Time","Completed Time","Order","Timezone","Is All Day","Is Floating","Column Name","Column Order","View Mode","taskId","parentId"',
  '"","Дом","Купить продукты","TEXT","","Молоко, хлеб","N","","2026-09-30T00:00:00+0000","","","5","0","2026-09-20T10:00:00+0000","","1","Europe/Moscow","true","false","","","list","t1",""',
  '"","Дом","Молоко","TEXT","","","N","","","","","0","0","","","2","Europe/Moscow","","","","","list","t2","t1"',
  '"","Спорт","Пробежка","TEXT","","","N","","2026-09-26T07:00:00+0000","","RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR","1","0","","","3","Europe/Moscow","false","false","","","list","t3",""',
  '"","Дом","Старое","TEXT","","","N","","","","","3","2","","","4","Europe/Moscow","","","","","list","t4",""',
  '"","Дом","Мысли","NOTE","","","N","","","","","0","0","","","5","","","","","","list","t5",""',
].join('\n');

const GOOGLE = JSON.stringify({
  kind: 'tasks#taskLists',
  items: [{
    kind: 'tasks#taskList', id: 'L1', title: 'Мои задачи',
    items: [
      { kind: 'tasks#task', id: 'a', title: 'Позвонить маме', notes: 'вечером', status: 'needsAction', due: '2026-09-28T00:00:00.000Z' },
      { kind: 'tasks#task', id: 'b', title: 'Взять подарок', status: 'needsAction', parent: 'a' },
      { kind: 'tasks#task', id: 'c', title: 'Сделано давно', status: 'completed' },
      { kind: 'tasks#task', id: 'd', title: 'Удалённая', status: 'needsAction', deleted: true },
    ],
  }],
});

const byTitle = (ts: ImportedTask[], t: string) => ts.find((x) => x.title === t)!;

describe('Todoist', () => {
  const r = parseImportFile(TODOIST);
  it('узнаётся по колонкам, BOM не мешает', () => expect(r.source).toBe('todoist'));
  it('берёт только задачи — без секций и комментариев', () => {
    expect(r.tasks.map((t) => t.title)).toEqual(['Отчёт за квартал', 'Цифры продаж', 'Зарядка', 'Созвон', 'Что-то']);
  });
  it('кавычки и запятые внутри описания', () => {
    expect(byTitle(r.tasks, 'Отчёт за квартал').notes).toBe('Собрать цифры, "свести" таблицу');
  });
  it('приоритет 4 (p1 в интерфейсе) — срочно, 3 — высокий', () => {
    expect(byTitle(r.tasks, 'Отчёт за квартал').priority).toBe(1);
    expect(byTitle(r.tasks, 'Созвон').priority).toBe(2);
    expect(byTitle(r.tasks, 'Зарядка').priority).toBe(3);
  });
  it('вложенность → подзадача, секция → тег', () => {
    const child = byTitle(r.tasks, 'Цифры продаж');
    expect(child.parentKey).toBe(byTitle(r.tasks, 'Отчёт за квартал').key);
    expect(child.list).toBe('Работа');
  });
  it('дата, время, повтор; непонятная дата — предупреждение', () => {
    expect(byTitle(r.tasks, 'Созвон')).toMatchObject({ date: '2026-10-06', time: '15:30' });
    expect(byTitle(r.tasks, 'Зарядка').recurrence).toBe('daily');
    expect(byTitle(r.tasks, 'Что-то').date).toBeNull();
    expect(r.warnings.join()).toMatch(/1 задач/);
  });
});

describe('TickTick', () => {
  const r = parseImportFile(TICKTICK);
  it('находит заголовок после служебных строк', () => expect(r.source).toBe('ticktick'));
  it('заметки не импортирует', () => expect(r.tasks.map((t) => t.title)).not.toContain('Мысли'));
  it('приоритет 5 — высокий, 1 — низкий', () => {
    expect(byTitle(r.tasks, 'Купить продукты').priority).toBe(2);
    expect(byTitle(r.tasks, 'Пробежка').priority).toBe(4);
  });
  it('статус 2 (архив) — выполнена, 0 — активна', () => {
    expect(byTitle(r.tasks, 'Старое').done).toBe(true);
    expect(byTitle(r.tasks, 'Купить продукты').done).toBe(false);
  });
  it('подзадачи по parentId, повтор по будням из RRULE, список → тег', () => {
    expect(byTitle(r.tasks, 'Молоко').parentKey).toBe('t1');
    expect(byTitle(r.tasks, 'Пробежка')).toMatchObject({ recurrence: 'weekdays', time: '07:00', date: '2026-09-26' });
    expect(byTitle(r.tasks, 'Купить продукты')).toMatchObject({ list: 'Дом', time: null, date: '2026-09-30' });
  });
});

describe('Google Tasks', () => {
  const r = parseImportFile(GOOGLE);
  it('узнаётся по JSON', () => expect(r.source).toBe('google-tasks'));
  it('удалённые пропускает, выполненные помечает', () => {
    expect(r.tasks.map((t) => t.title)).toEqual(['Позвонить маме', 'Взять подарок', 'Сделано давно']);
    expect(byTitle(r.tasks, 'Сделано давно').done).toBe(true);
  });
  it('срок берётся как дата, без сдвига поясом', () => {
    expect(byTitle(r.tasks, 'Позвонить маме')).toMatchObject({ date: '2026-09-28', notes: 'вечером', list: 'Мои задачи' });
    expect(byTitle(r.tasks, 'Взять подарок').parentKey).toBe('a');
  });
});

describe('неизвестные и битые файлы', () => {
  it('понятная ошибка вместо падения', () => {
    expect(() => parseImportFile('a,b,c\n1,2,3')).toThrow(ImportFormatError);
    expect(() => parseImportFile('{ битый')).toThrow(/повреждён/);
    expect(() => parseImportFile('')).toThrow(ImportFormatError);
  });
});

describe('создание задач', () => {
  type Made = { id: string; title: string; parent_id: string | null; status?: string; date: string };
  const run = (text: string, includeCompleted: boolean) => {
    const made: Made[] = [];
    const n = applyImport(parseImportFile(text).tasks, { includeCompleted, today: '2026-09-25' }, (t) => {
      const row = { id: `id${made.length}`, ...t };
      made.push(row);
      return row;
    });
    return { n, made };
  };

  it('родитель создаётся раньше подзадачи и связывается с ней', () => {
    const { made } = run(GOOGLE, false);
    const parent = made.find((m) => m.title === 'Позвонить маме')!;
    const child = made.find((m) => m.title === 'Взять подарок')!;
    expect(child.parent_id).toBe(parent.id);
    expect(made.indexOf(parent)).toBeLessThan(made.indexOf(child));
  });

  it('выполненные — только по желанию', () => {
    expect(run(GOOGLE, false).made.map((m) => m.title)).not.toContain('Сделано давно');
    const all = run(GOOGLE, true).made;
    expect(all.find((m) => m.title === 'Сделано давно')!.status).toBe('done');
  });

  it('без срока — на сегодня', () => {
    const { made } = run(TODOIST, false);
    expect(made.find((m) => m.title === 'Что-то')!.date).toBe('2026-09-25');
  });

  it('цикл родителей в испорченном файле не вешает импорт', () => {
    const loop = JSON.stringify({ items: [{ title: 'L', items: [
      { id: 'x', title: 'X', parent: 'y', status: 'needsAction' },
      { id: 'y', title: 'Y', parent: 'x', status: 'needsAction' },
    ] }] });
    expect(run(loop, false).n).toBeGreaterThan(0);
  });
});
