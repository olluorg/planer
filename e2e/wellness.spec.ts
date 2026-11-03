import { test, expect } from '@playwright/test';
import { DEFAULT_LAYOUT } from '../src/lib/dashboardPresets';
import fs from 'node:fs';
import fsPromises from 'node:fs/promises';

test.beforeEach(async ({ page }) => {
  const plugin = JSON.parse(fs.readFileSync('public/plugins/nutrition-month.thedad-widget.json', 'utf8'));
  Object.assign(plugin.source.static[0], { protein: 20, fat: 0, carbs: 35 });
  await page.addInitScript(({ plugin, ids }) => {
    localStorage.setItem('onboarding.done.v1', '1');
    if (localStorage.getItem('wellness.fixture')) return;
    localStorage.setItem('wellness.fixture', '1');
    localStorage.setItem('plugins.defaults.v4', '1');
    localStorage.setItem('plugins.installed.v1', JSON.stringify([plugin]));
    localStorage.setItem('workout.type.v1', 'obsolete-type');
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{ id: 'wellness', name: 'Wellness', hidden: ids.filter((id: string) => id !== 'workout'), layout: [
      { i: 'workout', x: 0, y: 0, w: 4, h: 6 },
      { i: 'plugin:nutrition-month', x: 4, y: 0, w: 8, h: 8 },
    ] }]));
    localStorage.setItem('dashboard.activeScreen.v1', 'wellness');
  }, { plugin, ids: DEFAULT_LAYOUT.map((l) => l.i) });
  await page.goto('/settings');
  await page.getByRole('button', { name: /Загрузить примеры/ }).click();
});

test('recipe eaten toggle stores macros and updates immediately', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  await page.getByRole('button', { name: 'Рецепт: Овсянка с бананом', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: 'Овсянка с бананом', exact: true });
  await expect(recipe.getByText('Жиры', { exact: true })).toBeVisible();
  await recipe.getByRole('button', { name: 'Отметить съеденным', exact: true }).click();
  await expect(recipe.getByRole('button', { name: 'Съедено — учтено', exact: true })).toBeVisible();
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toEqual([expect.objectContaining({ protein: 20, fat: 0, carbs: 35 })]);
  await recipe.getByRole('button', { name: 'Съедено — учтено', exact: true }).click();
  await expect(recipe.getByRole('button', { name: 'Отметить съеденным', exact: true })).toBeVisible();
});

test('recipe without calories remains unknown when marked eaten', async ({page}) => {
  await page.evaluate(() => {
    const plugins = JSON.parse(localStorage.getItem('plugins.installed.v1')!);
    delete plugins[0].source.static[0].kcal;
    localStorage.setItem('plugins.installed.v1', JSON.stringify(plugins));
  });
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  await page.getByRole('button', {name:'Рецепт: Овсянка с бананом', exact:true}).click();
  const recipe = page.getByRole('dialog', {name:'Овсянка с бананом', exact:true});
  await expect(recipe.getByText('Калорийность не указана.')).toBeVisible();
  await recipe.getByRole('button', {name:'Отметить съеденным'}).click();
  await expect(recipe.getByRole('button', {name:'Съедено — учтено'})).toBeVisible();
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toEqual([expect.objectContaining({title:'Овсянка с бананом'})]);
  expect(entries[0]).not.toHaveProperty('kcal');
  await page.evaluate((ids) => {
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{id:'calories-test', name:'Калории', hidden:ids.filter((id: string) => id !== 'calories'), layout:[{i:'calories',x:0,y:0,w:6,h:8}]}]));
    localStorage.setItem('dashboard.activeScreen.v1', 'calories-test');
  }, DEFAULT_LAYOUT.map(l => l.i));
  await page.goto('/');
  await expect(page.getByText('Калорийность части блюд неизвестна')).toBeVisible();
  await page.getByTitle('Открыть меню дня').click();
  await expect(page.getByText(/Калорийность указана не для всех записей/)).toBeVisible();
});

test('custom recipe can be saved without inventing zero calories', async ({page}) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  const planner = page.getByRole('dialog', {name:'Конструктор рациона'});
  await planner.getByRole('button', {name:'Добавить своё блюдо'}).click();
  await planner.getByPlaceholder('Название', {exact:true}).fill('Домашний суп');
  await planner.getByRole('button', {name:'В библиотеку'}).click();
  const dish = planner.getByRole('button', {name:'Выбрать блюдо: Домашний суп'});
  await expect(dish).toContainText('ккал не указаны');
  await planner.getByRole('button', {name:'Сохранить', exact:true}).click();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1')!).find((p: {id:string}) => p.id === 'nutrition-month').source.static.find((r: {title:string}) => r.title === 'Домашний суп'));
  expect(stored.kcal).toBeNull();
});

test('food diary write failure is visible above the recipe and does not mark the meal eaten', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  await page.getByRole('button', { name: 'Рецепт: Овсянка с бананом', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: 'Овсянка с бананом', exact: true });
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'nutrition.eaten.v1') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await recipe.getByRole('button', { name: 'Отметить съеденным', exact: true }).click();
  const warning = page.getByText('Изменения питания не сохранены', {exact:true});
  await expect(warning).toBeVisible();
  await expect(recipe.getByRole('button', { name: 'Отметить съеденным', exact: true })).toBeVisible();
  await expect(recipe.getByRole('button', { name: 'Съедено — учтено', exact: true })).toHaveCount(0);
  const aboveDialog = await warning.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return element.contains(document.elementFromPoint(rect.left + 5, rect.top + 5));
  });
  expect(aboveDialog).toBe(true);
});

test('food library write failure keeps the product form and entered values', async ({ page }) => {
  await page.evaluate((ids) => {
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{id:'calories-test', name:'Калории', hidden:ids.filter((id: string) => id !== 'calories'), layout:[{i:'calories',x:0,y:0,w:6,h:8}]}]));
    localStorage.setItem('dashboard.activeScreen.v1', 'calories-test');
  }, DEFAULT_LAYOUT.map(l => l.i));
  await page.goto('/');
  await page.getByTitle('Открыть меню дня').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name:'добавить', exact:true}).click();
  await dialog.getByPlaceholder('Название продукта').fill('Йогурт');
  await dialog.getByPlaceholder('ккал (на порцию)').fill('100');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'nutrition.foods.v1') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await dialog.getByRole('button', {name:'Сохранить в библиотеку'}).click();
  await expect(page.getByText('Изменения питания не сохранены', {exact:true})).toBeVisible();
  await expect(dialog.getByPlaceholder('Название продукта')).toHaveValue('Йогурт');
  await expect(dialog.getByPlaceholder('ккал (на порцию)')).toHaveValue('100');
});

test('food input rejects invalid macros and accepts explicit zero values', async ({ page }) => {
  await page.evaluate((ids) => {
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{id:'calories-test', name:'Калории', hidden:ids.filter((id: string) => id !== 'calories'), layout:[{i:'calories',x:0,y:0,w:6,h:8}]}]));
    localStorage.setItem('dashboard.activeScreen.v1', 'calories-test');
  }, DEFAULT_LAYOUT.map(l => l.i));
  await page.goto('/');
  await page.getByTitle('Открыть меню дня').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', {name:'добавить', exact:true}).click();
  await dialog.getByPlaceholder('Название продукта').fill('Вода');
  await dialog.getByPlaceholder('ккал (на порцию)').fill('0');
  await dialog.getByPlaceholder('Б, г').fill('-2');
  await dialog.getByRole('button', {name:'Сохранить в библиотеку'}).click();
  await expect(dialog.getByRole('alert')).toContainText('БЖУ должны быть неотрицательными');
  expect(await page.evaluate(() => localStorage.getItem('nutrition.foods.v1'))).toBeNull();
  await dialog.getByPlaceholder('Б, г').fill('0');
  await dialog.getByRole('button', {name:'Сохранить в библиотеку'}).click();
  await expect(dialog.getByText('0 ккал · Б 0', {exact:true})).toBeVisible();
  await dialog.getByPlaceholder('Что ещё съел…').fill('Вода');
  await dialog.getByPlaceholder('ккал', {exact:true}).fill('Infinity');
  await dialog.getByRole('button', {name:'Добавить запись о еде'}).click();
  await expect(dialog.getByRole('alert')).toContainText('неотрицательное число калорий');
  await dialog.getByPlaceholder('ккал', {exact:true}).fill('0');
  await dialog.getByRole('button', {name:'Добавить запись о еде'}).click();
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toEqual([expect.objectContaining({title:'Вода', kcal:0})]);
});

test('calorie menu records recipe macros and identifies incomplete entries', async ({ page }) => {
  await page.evaluate((ids) => {
    const plugins = JSON.parse(localStorage.getItem('plugins.installed.v1')!);
    plugins[0].source.static = [plugins[0].source.static[0]];
    plugins[0].source.static[0].day = 1;
    localStorage.setItem('plugins.installed.v1', JSON.stringify(plugins));
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{id:'calories-test', name:'Калории', hidden:ids.filter((id: string) => id !== 'calories'), layout:[{i:'calories',x:0,y:0,w:6,h:8}]}]));
    localStorage.setItem('dashboard.activeScreen.v1', 'calories-test');
  }, DEFAULT_LAYOUT.map(l => l.i));
  await page.goto('/');
  await page.getByTitle('Открыть меню дня').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Для оценки баланса нужны записи о еде и заполненный профиль.', {exact:true})).toBeVisible();
  await expect(dialog.getByText('Баланс за неделю')).toHaveCount(0);
  await dialog.getByRole('button', {name: /Овсянка с бананом/}).click();
  await expect(dialog.getByText('Для оценки баланса нужны записи о еде и заполненный профиль.', {exact:true})).toBeVisible();
  const entries = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('nutrition.eaten.v1')!)).flat());
  expect(entries).toEqual([expect.objectContaining({protein:20, fat:0, carbs:35})]);
  await expect(dialog.getByText('БЖУ указаны не для всех записей.', {exact:false})).toHaveCount(0);
  await dialog.getByPlaceholder('Что ещё съел…').fill('Яблоко');
  await dialog.getByPlaceholder('ккал', {exact:true}).fill('70');
  await dialog.getByPlaceholder('ккал', {exact:true}).press('Enter');
  await expect(dialog.getByText('БЖУ указаны не для всех записей.', {exact:false})).toBeVisible();
  await dialog.getByRole('button', {name:/Профиль и расчёт расхода/}).click();
  await dialog.getByRole('button', {name:'Муж', exact:true}).click();
  await dialog.getByPlaceholder('Возраст').fill('30');
  await dialog.getByPlaceholder('Возраст').blur();
  await dialog.getByPlaceholder('Рост, см').fill('175');
  await dialog.getByPlaceholder('Рост, см').blur();
  await expect(dialog.getByText('Баланс за неделю', {exact:true})).toBeVisible();
  await expect(dialog.getByText(/Дни без записей о еде не показаны/)).toBeVisible();
});

test('new workout has seven real images and supports start, pause and next', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать тренировку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Тренировка', exact: true });
  await expect(dialog.getByRole('button', { name: 'Без прыжков', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('img', { name: 'Шаг на месте', exact: true })).toBeVisible();
  await dialog.locator('summary').click();
  await expect(dialog.getByRole('list', { name: 'Упражнения до старта' }).locator('li')).toHaveCount(7);
  await dialog.getByRole('button', { name: 'Начать · Без прыжков', exact: true }).click();
  await page.waitForTimeout(1200); // let the workout record real elapsed time before pausing
  await dialog.getByRole('button', { name: 'Пауза', exact: true }).click();
  for (const name of ['Шаг на месте', 'Приседания', 'Подъём на носки', 'Ягодичный мостик', 'Птица-собака', 'Планка', 'Поза ребёнка']) {
    const img = dialog.getByRole('img', { name, exact: true });
    await expect(img).toBeVisible();
    await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await dialog.getByRole('button', { name: 'Пропустить упражнение' }).click();
  }
  await expect(dialog.getByText('Без прыжков — готово!', { exact: true })).toBeVisible();
});

test('charge workout loads the new push-up photograph', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { Math.random = () => 0.999999; });
  await page.getByRole('button', {name:'Выбрать тренировку', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Тренировка', exact:true});
  await dialog.getByRole('button', {name:'Зарядка', exact:true}).click();
  const jack = dialog.getByRole('img', {name:'Джампинг джек', exact:true});
  await expect(jack).toHaveAttribute('src', '/workout/studio/jumping-jack.webp');
  await expect.poll(() => jack.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', {name:'Начать · Зарядка', exact:true}).click();
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const img = dialog.getByRole('img', {name:'Отжимания', exact:true});
  await expect(img).toBeVisible();
  await expect(img).toHaveAttribute('src', '/workout/studio/push-up.webp');
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const lunge = dialog.getByRole('img', {name:'Выпады вперёд', exact:true});
  await expect(lunge).toHaveAttribute('src', '/workout/studio/forward-lunge.webp');
  await expect.poll(() => lunge.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const crunch = dialog.getByRole('img', {name:'Скручивания', exact:true});
  await expect(crunch).toHaveAttribute('src', '/workout/studio/crunch.webp');
  await expect.poll(() => crunch.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('yoga loads the cat-cow photograph', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { Math.random = () => 0.999999; });
  await page.getByRole('button', {name:'Выбрать тренировку', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Тренировка', exact:true});
  await dialog.getByRole('button', {name:'Йога', exact:true}).click();
  const mountain = dialog.getByRole('img', {name:'Поза горы', exact:true});
  await expect(mountain).toHaveAttribute('src', '/workout/studio/mountain-pose.webp');
  await expect.poll(() => mountain.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', {name:'Начать · Йога', exact:true}).click();
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const dog = dialog.getByRole('img', {name:'Собака мордой вниз', exact:true});
  await expect(dog).toHaveAttribute('src', '/workout/studio/downward-dog.webp');
  await expect.poll(() => dog.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  for (let i = 0; i < 2; i++) await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const image = dialog.getByRole('img', {name:'Кошка-корова', exact:true});
  await expect(image).toHaveAttribute('src', '/workout/studio/cat-cow.webp');
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const cobra = dialog.getByRole('img', {name:'Поза кобры', exact:true});
  await expect(cobra).toHaveAttribute('src', '/workout/studio/cobra-pose.webp');
  await expect.poll(() => cobra.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const warrior = dialog.getByRole('img', {name:'Поза воина II', exact:true});
  await expect(warrior).toHaveAttribute('src', '/workout/studio/warrior-two.webp');
  await expect.poll(() => warrior.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const fold = dialog.getByRole('img', {name:'Наклон вперёд стоя', exact:true});
  await expect(fold).toHaveAttribute('src', '/workout/studio/standing-forward-fold.webp');
  await expect.poll(() => fold.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('calisthenics loads the side plank photograph', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { Math.random = () => 0.999999; });
  await page.getByRole('button', {name:'Выбрать тренировку', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Тренировка', exact:true});
  await dialog.getByRole('button', {name:'Калистеника', exact:true}).click();
  await dialog.getByRole('button', {name:'Начать · Калистеника', exact:true}).click();
  for (let i = 0; i < 6; i++) await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const image = dialog.getByRole('img', {name:'Боковая планка слева', exact:true});
  await expect(image).toHaveAttribute('src', '/workout/studio/side-plank.webp');
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('charge and calisthenics load the new floor exercise images', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => { Math.random = () => 0.1; });
  await page.getByRole('button', {name:'Выбрать тренировку', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Тренировка', exact:true});
  await dialog.getByRole('button', {name:'Зарядка', exact:true}).click();
  const bicycle = dialog.getByRole('img', {name:'Велосипед', exact:true});
  await expect(bicycle).toHaveAttribute('src', '/workout/studio/bicycle-crunch.webp');
  await expect.poll(() => bicycle.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => { Math.random = () => 0.7; });
  await dialog.getByRole('button', {name:'Калистеника', exact:true}).click();
  await dialog.getByRole('button', {name:'Начать · Калистеника', exact:true}).click();
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
  const legRaise = dialog.getByRole('img', {name:'Подъём ног лёжа', exact:true});
  await expect(legRaise).toHaveAttribute('src', '/workout/studio/leg-raise.webp');
  await expect.poll(() => legRaise.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

for (const exercise of [
  {type:'Зарядка', name:'Бег на месте', file:'jog-in-place', random:0.3, index:1},
  {type:'Зарядка', name:'Махи руками', file:'arm-circles', random:0.19, index:1},
  {type:'Калистеника', name:'Супермен', file:'superman', random:0.5, index:5},
  {type:'Калистеника', name:'Скалолаз', file:'mountain-climber', random:0.1, index:0},
  {type:'Йога', name:'Поза дерева (слева)', file:'tree-pose', random:0, index:6},
  {type:'Йога', name:'Поза дерева (справа)', file:'tree-pose', random:0.12, index:0},
  {type:'Йога', name:'Поза лодки', file:'boat-pose', random:0.08, index:0},
]) {
  test(`workout shows the ${exercise.name} image`, async ({ page }) => {
    await page.goto('/');
    await page.evaluate(value => { Math.random = () => value; }, exercise.random);
    await page.getByRole('button', {name:'Выбрать тренировку', exact:true}).click();
    const dialog = page.getByRole('dialog', {name:'Тренировка', exact:true});
    await dialog.getByRole('button', {name:exercise.type, exact:true}).click();
    await dialog.getByRole('button', {name:`Начать · ${exercise.type}`, exact:true}).click();
    for (let i = 0; i < exercise.index; i++) await dialog.getByRole('button', {name:'Пропустить упражнение'}).click();
    const photo = dialog.getByRole('img', {name:exercise.name, exact:true});
    await expect(photo).toHaveAttribute('src', `/workout/studio/${exercise.file}.webp`);
    await expect.poll(() => photo.evaluate((el:HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    if (exercise.name === 'Поза дерева (справа)') await expect(photo).toHaveCSS('transform', 'matrix(-1, 0, 0, 1, 0, 0)');
  });
}

test('yoga records its own intensity and persists the completed session', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать тренировку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Тренировка', exact: true });
  const yoga = dialog.getByRole('button', { name: 'Йога', exact: true });
  await yoga.focus();
  await page.keyboard.press('Space');
  await expect(yoga).toHaveAttribute('aria-pressed', 'true');
  await expect(dialog.getByRole('button', { name: 'Начать · Йога', exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Начать · Йога', exact: true }).click();
  await page.waitForTimeout(1200);
  await dialog.getByRole('button', { name: 'Пауза', exact: true }).click();
  for (let i = 0; i < 7; i++) await dialog.getByRole('button', { name: 'Пропустить упражнение' }).click();
  await expect(dialog.getByText('Йога — готово!', { exact: true })).toBeVisible();
  const recorded = await page.evaluate(() => {
    const totals = JSON.parse(localStorage.getItem('workout.sessions.v1') || '{}');
    const details = JSON.parse(localStorage.getItem('workout.met-seconds.v1') || '{}');
    const dates = Object.keys(totals);
    return { totals, details, date: dates[0] };
  });
  expect(recorded.totals[recorded.date]).toBeGreaterThan(0);
  expect(recorded.details[recorded.date].seconds).toBe(recorded.totals[recorded.date]);
  expect(recorded.details[recorded.date].metSeconds).toBeCloseTo(recorded.totals[recorded.date] * 2.3);
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('workout.met-seconds.v1') || '{}'))).toEqual(recorded.details);
});

test('leaving a workout saves elapsed activity without marking it completed', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать тренировку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Тренировка', exact: true });
  await dialog.getByRole('button', { name: 'Йога', exact: true }).click();
  await dialog.getByRole('button', { name: 'Начать · Йога', exact: true }).click();
  await page.waitForTimeout(1200);
  await dialog.getByRole('button', { name: 'Пауза', exact: true }).click();
  await dialog.getByRole('button', { name: /Выйти/ }).click();
  await expect(dialog).toHaveCount(0);
  const snapshot = await page.evaluate(() => ({
    sessions: JSON.parse(localStorage.getItem('workout.sessions.v1') || '{}'),
    details: JSON.parse(localStorage.getItem('workout.met-seconds.v1') || '{}'),
    done: localStorage.getItem('workout.last.v1'),
  }));
  const [date] = Object.keys(snapshot.sessions);
  expect(snapshot.sessions[date]).toBeGreaterThan(0);
  expect(snapshot.details[date].metSeconds).toBeCloseTo(snapshot.sessions[date] * 2.3);
  expect(snapshot.done).toBeNull();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('workout.sessions.v1') || '{}'))).toEqual(snapshot.sessions);
});

test('the seven minute timer completes and records the session once', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать тренировку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Тренировка', exact: true });
  await dialog.getByRole('button', { name: 'Начать · Без прыжков', exact: true }).click();
  await page.clock.runFor(420_000);
  await expect(dialog.getByText('Без прыжков — готово!', {exact:true})).toBeVisible();
  const saved = await page.evaluate(() => ({
    durations: JSON.parse(localStorage.getItem('workout.sessions.v1') || '{}'),
    details: JSON.parse(localStorage.getItem('workout.met-seconds.v1') || '{}'),
  }));
  const [date] = Object.keys(saved.durations);
  expect(saved.durations[date]).toBe(420);
  expect(saved.details[date]).toEqual({seconds:420, metSeconds:1470});
  await dialog.getByRole('button', {name:'Готово', exact:true}).click();
  await page.reload();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('workout.sessions.v1') || '{}'))).toEqual(saved.durations);
});

test('completed workout can retry a failed activity write without duplicate time', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.evaluate(() => {
    sessionStorage.setItem('fail-workout-save', '1');
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'workout.sessions.v1' && sessionStorage.getItem('fail-workout-save') === '1') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await page.getByRole('button', {name:'Выбрать тренировку', exact:true}).click();
  const dialog = page.getByRole('dialog', {name:'Тренировка', exact:true});
  await dialog.getByRole('button', {name:'Начать · Без прыжков', exact:true}).click();
  await page.clock.runFor(420_000);
  await expect(dialog.getByText(/активность не записана/)).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('workout.sessions.v1'))).toBeNull();
  await page.evaluate(() => sessionStorage.removeItem('fail-workout-save'));
  await dialog.getByRole('button', {name:'Повторить сохранение активности'}).click();
  await expect(dialog.getByText(/В журнал записано фактическое время/)).toBeVisible();
  expect(Object.values(await page.evaluate(() => JSON.parse(localStorage.getItem('workout.sessions.v1')!)))).toEqual([420]);
  await expect(dialog.getByRole('button', {name:'Повторить сохранение активности'})).toHaveCount(0);
});

test('workout timer catches up after delayed callbacks and excludes paused time', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать тренировку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Тренировка', exact: true });
  await dialog.getByRole('button', { name: 'Начать · Без прыжков', exact: true }).click();
  await page.clock.fastForward(125_000);
  await expect(dialog.getByText('Упражнение 3 из 7')).toBeVisible();
  await expect(dialog.getByText('00:55', {exact:true})).toBeVisible();
  await dialog.getByRole('button', { name: 'Пауза', exact: true }).click();
  await page.clock.fastForward(120_000);
  await expect(dialog.getByText('00:55', {exact:true})).toBeVisible();
  await dialog.getByRole('button', { name: /Выйти/ }).click();
  const durations = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.sessions.v1') || '{}'));
  expect(Object.values(durations)).toEqual([125]);
});

test('pausing before a delayed timer callback saves elapsed time', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Выбрать тренировку', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Тренировка', exact: true });
  await dialog.getByRole('button', { name: 'Начать · Без прыжков', exact: true }).click();
  await dialog.getByRole('button', { name: 'Пауза', exact: true }).evaluate((button: HTMLButtonElement) => {
    const until = performance.now() + 1200;
    while (performance.now() < until) { /* simulate a blocked event loop */ }
    button.click();
  });
  await dialog.getByRole('button', { name: /Выйти/ }).click();
  const durations = await page.evaluate(() => JSON.parse(localStorage.getItem('workout.sessions.v1') || '{}'));
  expect(Object.values(durations)).toEqual([1]);
});

test('new recipe can be previewed, added and preserved without overwriting the existing plan', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  const planner = page.getByRole('dialog', { name: 'Конструктор рациона', exact: true });
  await expect(planner.getByLabel('Питание за день 1', { exact: true })).toContainText('Частичный итог');
  await planner.getByLabel('Подобрать под свой день').selectOption('quick');
  await expect(planner.getByRole('button', { name: /^Выбрать блюдо:/ })).toHaveCount(3);
  await planner.getByLabel('Подобрать под свой день').selectOption('all');
  await planner.getByRole('button', { name: 'Новая коллекция · 8 блюд' }).click();
  await expect(planner.getByRole('button', { name: /^Выбрать блюдо:/ })).toHaveCount(8);
  await planner.getByRole('button', { name: 'Рецепт: Овсянка с бананом и орехами', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: 'Овсянка с бананом и орехами', exact: true });
  const img = recipe.getByRole('img', { name: 'Овсянка с бананом и орехами', exact: true });
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await expect(recipe.getByText(/Ингредиенты:/)).toBeVisible();
  await expect(recipe.getByText('Белки', {exact:true})).toBeVisible();
  await recipe.getByRole('button', { name: 'Закрыть (Esc)', exact: true }).click();
  await planner.getByRole('button', { name: 'Выбрать блюдо: Овсянка с бананом и орехами', exact: true }).click();
  await planner.locator('tbody tr').first().locator('td').nth(1).click();
  await planner.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1')!)[0].source.static);
  expect(saved.some((r: any) => r.day === 1 && r.title === 'Овсянка с бананом и орехами')).toBe(true);
  expect(saved.find((r: any) => r.day === 1 && r.title === 'Овсянка с бананом и орехами')).toEqual(expect.objectContaining({kcal:344, protein:9.2, fat:10.1, carbs:58.1}));
  expect(saved.some((r: any) => r.day === 1 && r.title === 'Овсянка с бананом')).toBe(true);
  await page.getByTitle('Открыть конструктор рациона').click();
  await planner.getByRole('button', { name: 'Новая коллекция · 8 блюд' }).click();
  await expect(planner.getByRole('button', { name: /^Выбрать блюдо:/ })).toHaveCount(8);
});

test('a missing recipe photo does not leave a broken image or hide the recipe', async ({ page }) => {
  await page.route('**/food/studio/salmon-asparagus.webp', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  await page.getByRole('button', { name: 'Новая коллекция · 8 блюд' }).click();
  await page.getByRole('button', { name: 'Рецепт: Лосось со спаржей', exact: true }).click();
  const recipe = page.getByRole('dialog', { name: 'Лосось со спаржей', exact: true });
  await expect(recipe.getByText('Фото не добавлено', { exact: true })).toBeVisible();
  await expect(recipe.locator('img')).toHaveCount(0);
  await expect(recipe.getByText(/Ингредиенты:/)).toBeVisible();
});

test('protein meal adds its nutrition to the saved plan', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  const planner = page.getByRole('dialog', {name:'Конструктор рациона', exact:true});
  await planner.getByRole('button', {name:'Новая коллекция · 8 блюд'}).click();
  await planner.getByRole('button', {name:'Рецепт: Индейка с картофелем и брокколи', exact:true}).click();
  const recipe = page.getByRole('dialog', {name:'Индейка с картофелем и брокколи'});
  const photo = recipe.getByRole('img', {name:'Индейка с картофелем и брокколи'});
  await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  await recipe.getByRole('button', {name:'Закрыть (Esc)'}).click();
  await planner.getByRole('button', {name:'Выбрать блюдо: Индейка с картофелем и брокколи'}).click();
  await planner.locator('tbody tr').first().locator('td').nth(1).click();
  await planner.getByRole('button', {name:'Сохранить', exact:true}).click();
  await page.reload();
  const rows = await page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1')!)[0].source.static);
  expect(rows.find((row: {title:string}) => row.title === 'Индейка с картофелем и брокколи')).toEqual(expect.objectContaining({kcal:403, protein:42.4, fat:7.8, carbs:41.8}));
});

test('enjoyment filter offers pizza with an explicit portion and macros', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  const planner = page.getByRole('dialog', {name:'Конструктор рациона', exact:true});
  await planner.getByLabel('Подобрать под свой день').selectOption('enjoy');
  await expect(planner.getByRole('button', {name:'Выбрать блюдо: Пицца «Маргарита»'})).toBeVisible();
  await planner.getByRole('button', {name:'Рецепт: Пицца «Маргарита»'}).click();
  const recipe = page.getByRole('dialog', {name:'Пицца «Маргарита»'});
  await expect(recipe.getByText(/одну небольшую пиццу/)).toBeVisible();
  await expect(recipe.getByText('Белки', {exact:true})).toBeVisible();
  const photo = recipe.getByRole('img', {name:'Пицца «Маргарита»'});
  await expect.poll(() => photo.evaluate((el:HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('budget filter offers lentil soup with a recipe and photo', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  const planner = page.getByRole('dialog', {name:'Конструктор рациона', exact:true});
  await planner.getByLabel('Подобрать под свой день').selectOption('budget');
  await expect(planner.getByRole('button', {name:'Выбрать блюдо: Чечевичный суп с овощами'})).toBeVisible();
  await planner.getByRole('button', {name:'Рецепт: Чечевичный суп с овощами'}).click();
  const recipe = page.getByRole('dialog', {name:'Чечевичный суп с овощами'});
  await expect(recipe.getByText(/заранее сваренной чечевицы/)).toBeVisible();
  const photo = recipe.getByRole('img', {name:'Чечевичный суп с овощами'});
  await expect.poll(() => photo.evaluate((el:HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
});

test('saved meal plan can be exported and restored separately', async ({ page }) => {
  await page.goto('/');
  await page.getByTitle('Открыть конструктор рациона').click();
  const planner = page.getByRole('dialog', {name:'Конструктор рациона', exact:true});
  await planner.getByRole('button', {name:'Новая коллекция · 8 блюд'}).click();
  await planner.getByRole('button', {name:'Выбрать блюдо: Чечевичный суп с овощами'}).click();
  await planner.locator('tbody tr').first().locator('td').nth(1).click();
  await planner.getByRole('button', {name:'Сохранить', exact:true}).click();
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', {name:'Экспорт плана питания'}).click();
  const file = await download;
  const data = await fsPromises.readFile((await file.path())!);
  expect(JSON.parse(data.toString()).source.static.some((row:{title:string}) => row.title === 'Чечевичный суп с овощами')).toBe(true);
  await page.evaluate(() => {
    const plugins = JSON.parse(localStorage.getItem('plugins.installed.v1')!);
    plugins[0].source.static = plugins[0].source.static.filter((row:{title:string}) => row.title !== 'Чечевичный суп с овощами');
    localStorage.setItem('plugins.installed.v1', JSON.stringify(plugins));
  });
  await page.reload();
  const importInput = page.getByText('Импортировать .json', {exact:true}).locator('..').locator('input[type=file]');
  page.once('dialog', dialog => dialog.dismiss());
  await importInput.setInputFiles({name:'meal.json',mimeType:'application/json',buffer:data});
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1')!)[0].source.static.some((row:{title:string}) => row.title === 'Чечевичный суп с овощами'))).toBe(false);
  page.once('dialog', dialog => dialog.accept());
  await importInput.setInputFiles({name:'meal.json',mimeType:'application/json',buffer:data});
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('plugins.installed.v1')!)[0].source.static.some((row:{title:string}) => row.title === 'Чечевичный суп с овощами'))).toBe(true);
});
