import { afterEach, expect, it, vi } from 'vitest';
import { readCalories, readMacros, toggleEaten, eatenMacros, eatenKcal, hasCompleteEatenCalories, isEatenStorageReadable, isFoodStorageReadable, addFood, addCustomEaten, eatFood, getEaten, getFoods, setKcalGoal, importFoods } from '../nutrition';

afterEach(() => vi.unstubAllGlobals());

it('keeps zero distinct from missing or invalid macros', () => {
  expect(readMacros({ protein: 0, fat: -2, carbs: Infinity })).toEqual({ protein: 0 });
  expect(readMacros({ protein: null, fat: '', carbs: '20' })).toEqual({});
});

it('ignores invalid saved nutrition values in totals and leaves the diary unchanged', () => {
  const date = '2026-11-02';
  const raw = JSON.stringify({[date]: [
    {key:'good', title:'Завтрак', meal:'Завтрак', kcal:200, protein:20, fat:0, carbs:30},
    {key:'bad', title:'Обед', meal:'Обед', kcal:'500', protein:'30', fat:-5, carbs:null},
  ]});
  vi.stubGlobal('localStorage', {getItem: () => raw});
  expect(eatenKcal(date)).toBe(200);
  expect(eatenMacros(date)).toEqual({protein:20, fat:0, carbs:30});
  expect(hasCompleteEatenCalories(date)).toBe(false);
  expect(localStorage.getItem('nutrition.eaten.v1')).toBe(raw);
});

it('preserves an explicit zero and leaves unknown macros absent in personal foods and the food log', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  const food = addFood({ title: 'Продукт', kcal: 100, protein: 0, fat: 3.24 })[0];
  expect(food.protein).toBe(0);
  expect(food.fat).toBe(3.2);
  expect(food.carbs).toBeUndefined();
  eatFood('2026-10-28', food);
  expect(readMacros(getEaten('2026-10-28')[0])).toEqual({protein: 0, fat: 3.2});
});

it('persists meal macros in daily totals and removes them when unchecked', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  const item = { key: 'Обед¦Тест', title: 'Тест', meal: 'Обед', kcal: 400, ...readMacros({ protein: 30, fat: 12, carbs: 40 }) };
  toggleEaten('2026-10-26', item);
  expect(eatenMacros('2026-10-26')).toEqual({ protein: 30, fat: 12, carbs: 40 });
  expect(eatenKcal('2026-10-26')).toBe(400);
  toggleEaten('2026-10-26', item);
  expect(eatenMacros('2026-10-26')).toEqual({ protein: 0, fat: 0, carbs: 0 });
});

it('does not silently discard old diary days or products when saving', () => {
  const days = Object.fromEntries(Array.from({length: 91}, (_, i) => [`day-${String(i).padStart(3, '0')}`, [{key:`k${i}`, title:'Еда', kcal:1, meal:'Обед'}]]));
  const foods = Array.from({length: 200}, (_, i) => ({id:String(i), title:`Продукт ${i}`, kcal:10}));
  const data = new Map<string, string>([['nutrition.eaten.v1', JSON.stringify(days)], ['nutrition.foods.v1', JSON.stringify(foods)]]);
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value) });
  vi.stubGlobal('window', { dispatchEvent: vi.fn() });
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  toggleEaten('new-day', {key:'new', title:'Новое', kcal:1, meal:'Обед'});
  addFood({title:'Новый продукт', kcal:10});
  expect(Object.keys(JSON.parse(data.get('nutrition.eaten.v1')!))).toHaveLength(92);
  expect(getFoods()).toHaveLength(201);
  expect(getEaten('day-000')).toHaveLength(1);
});

it('reports failed storage writes and does not announce a change', () => {
  const dispatch = vi.fn();
  vi.stubGlobal('localStorage', {getItem: () => null, setItem: () => { throw new Error('quota'); }});
  vi.stubGlobal('window', {dispatchEvent: dispatch});
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  expect(() => toggleEaten('2026-11-02', {key:'1', title:'Еда', kcal:1, meal:'Обед'})).toThrow('дневник питания');
  expect(() => addFood({title:'Продукт', kcal:10})).toThrow('библиотеку продуктов');
  expect(() => setKcalGoal(2000)).toThrow('цель по калориям');
  expect(dispatch).not.toHaveBeenCalled();
});

it('rejects invalid calories and macros without writing corrupt data', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value)});
  vi.stubGlobal('window', {dispatchEvent: vi.fn()});
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  expect(() => addFood({title:'Продукт', kcal:Infinity})).toThrow('калорий');
  expect(() => addFood({title:'Продукт', kcal:10, protein:-1})).toThrow('БЖУ');
  expect(() => addCustomEaten('2026-11-02', 'Еда', NaN)).toThrow('калорий');
  expect(() => toggleEaten('2026-11-02', {key:'x', title:'Еда', kcal:10, meal:'Обед', fat:Infinity})).toThrow('БЖУ');
  expect(() => setKcalGoal(Infinity)).toThrow('числовую цель');
  expect(data.size).toBe(0);
  expect(importFoods({foods:[{title:'Бесконечность', kcal:Infinity}]})).toBe(0);
  expect(addFood({title:'Вода', kcal:0, protein:0})[0]).toMatchObject({kcal:0, protein:0});
});

it('keeps unknown calories distinct from zero in the diary', () => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value)});
  vi.stubGlobal('window', {dispatchEvent: vi.fn()});
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  const date = '2026-11-02';
  expect(readCalories(null)).toBeUndefined();
  expect(readCalories(0)).toBe(0);
  toggleEaten(date, {key:'unknown', title:'Суп', meal:'Обед'});
  expect(getEaten(date)[0].kcal).toBeUndefined();
  expect(hasCompleteEatenCalories(date)).toBe(false);
  toggleEaten(date, {key:'unknown', title:'Суп', meal:'Обед'});
  addCustomEaten(date, 'Вода', 0);
  expect(hasCompleteEatenCalories(date)).toBe(true);
  expect(eatenKcal(date)).toBe(0);
});

it('never replaces corrupted diary or food-library data with an empty collection', () => {
  const data = new Map([['nutrition.eaten.v1', '{broken'], ['nutrition.foods.v1', '{"not":"an array"}']]);
  vi.stubGlobal('localStorage', {getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value)});
  vi.stubGlobal('window', {dispatchEvent: vi.fn()});
  vi.stubGlobal('CustomEvent', class { constructor(public type: string) {} });
  expect(isEatenStorageReadable()).toBe(false);
  expect(isFoodStorageReadable()).toBe(false);
  expect(() => addCustomEaten('2026-11-02', 'Еда', 10)).toThrow('повреждён');
  expect(() => addFood({title:'Продукт', kcal:10})).toThrow('повреждена');
  expect(() => importFoods({foods:[{title:'Еда', kcal:10}]})).toThrow('повреждена');
  expect(data.get('nutrition.eaten.v1')).toBe('{broken');
  expect(data.get('nutrition.foods.v1')).toBe('{"not":"an array"}');
});
