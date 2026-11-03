/** Additional library entries, never a replacement for the user's meal schedule. */
type Dish = Record<string, string | number | null>;

export const DINING_FILTERS = [
  { id: 'all', label: 'Все блюда', hint: 'Выбери блюдо и добавь его в нужный день.' },
  { id: 'everyday', label: 'На каждый день', hint: 'Простые блюда для обычного дня.' },
  { id: 'budget', label: 'Бюджетно', hint: 'Базовые продукты без дорогих добавок. Стоимость зависит от магазина.' },
  { id: 'quick', label: 'До 15 минут', hint: 'Блюда с указанным временем приготовления до 15 минут.' },
  { id: 'protein', label: 'Больше белка', hint: 'От 25 г белка на указанную порцию. Только блюда с заполненными БЖУ.' },
  { id: 'light', label: 'До 400 ккал', hint: 'До 400 ккал на указанную порцию. Итог дня зависит от всего рациона.' },
  { id: 'enjoy', label: 'Для удовольствия', hint: 'Блюда, которые можно выбрать по вкусу и включить в свой день.' },
] as const;
export type DiningFilter = typeof DINING_FILTERS[number]['id'];
const BUDGET = new Set(['Овсянка с бананом', 'Овсянка с бананом и орехами', 'Омлет со шпинатом и томатами', 'Чечевичный суп с овощами', 'Манная каша', 'Гречка с молоком', 'Омлет', 'Гороховый суп', 'Тушёная капуста', 'Рожки с сыром']);
export function matchesDiningFilter(dish: Dish, filter: DiningFilter): boolean {
  const number = (key: string) => typeof dish[key] === 'number' && Number.isFinite(dish[key]) ? dish[key] as number : null;
  if (filter === 'budget') return BUDGET.has(String(dish.title));
  if (filter === 'quick') return number('minutes') !== null && number('minutes')! > 0 && number('minutes')! <= 15;
  if (filter === 'protein') return number('protein') !== null && number('protein')! >= 25;
  if (filter === 'light') return number('kcal') !== null && number('kcal')! > 0 && number('kcal')! <= 400;
  if (filter === 'everyday') return dish.kind === 'Основное' || dish.collection === 'studio-2026';
  if (filter === 'enjoy') return dish.title === 'Пицца «Маргарита»';
  return true;
}

/** Missing nutrition is reported separately, never silently treated as a complete total. */
export function diningTotals(dishes: Dish[]) {
  const totals = { kcal: 0, protein: 0, fat: 0, carbs: 0, missing: 0 };
  for (const dish of dishes) {
    let complete = true;
    for (const key of ['kcal', 'protein', 'fat', 'carbs'] as const) {
      const value = dish[key];
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) totals[key] += value;
      else complete = false;
    }
    if (!complete) totals.missing++;
  }
  return totals;
}
const photo = (id: string) => `/food/studio/${id}.webp`;
const estimate = 'БЖУК ориентировочные на одну порцию, рассчитаны по ингредиентам USDA FoodData Central; зависят от марки, массы и приготовления.';

export const DINING_COLLECTION: Dish[] = [
  {
    title: 'Чечевичный суп с овощами', meal: 'Обед', kind: 'Основное', minutes: 25,
    desc: '25 минут · 1 порция · из готовой чечевицы',
    recipe: 'Ингредиенты: варёная чечевица без жидкости 180 г, сырая морковь 100 г, сырой лук 50 г, свежие томаты 100 г, оливковое масло 5 г, вода, соль и специи по вкусу.\nВымой и нарежь овощи. Слегка прогрей лук и морковь на масле.\nДобавь томаты и воду, вари до мягкости моркови.\nДобавь готовую чечевицу, прогрей и приправь по вкусу.\nВремя указано для заранее сваренной чечевицы.\n' + estimate,
    kcal: 332, protein: 18.6, fat: 6.2, carbs: 54.4,
    image: photo('lentil-soup'), gallery: photo('lentil-soup'), collection: 'studio-2026',
  },
  {
    title: 'Пицца «Маргарита»', meal: 'Ужин', kind: 'Основное', minutes: 90,
    desc: 'Около 90 минут · 1 небольшая пицца · домашняя выпечка',
    recipe: 'Ингредиенты: на одну небольшую пиццу — пшеничная мука 100 г, вода около 60 мл, сухие дрожжи 2 г, томатный соус без добавок 70 г, моцарелла из частично обезжиренного молока 80 г, оливковое масло 5 г, базилик и соль по вкусу.\nСмешай муку, дрожжи, воду и масло, замеси мягкое тесто и оставь под крышкой на 45–60 минут.\nРазогрей духовку до 230 °C. Раскатай тесто, добавь соус и нарезанную моцареллу.\nВыпекай около 10–15 минут до готовности теста и расплавления сыра; время зависит от духовки. Перед подачей добавь базилик.\nАллергены: пшеница, молоко.\n' + estimate,
    kcal: 635, protein: 31.4, fat: 19.1, carbs: 83.1,
    image: photo('margherita'), gallery: photo('margherita'), collection: 'studio-2026',
  },
  {
    title: 'Омлет со шпинатом и томатами', meal: 'Завтрак', kind: 'Основное', minutes: 15,
    desc: '15 минут · 1 порция · простой завтрак',
    recipe: 'Ингредиенты: яйца без скорлупы 100 г (примерно 2 шт.), шпинат 40 г, помидор 100 г, оливковое масло 5 г, соль по вкусу.\nПромой шпинат и помидор, нарежь помидор.\nПрогрей шпинат на масле, влей взбитые яйца и готовь на небольшом огне до полной готовности.\nПодавай с помидором.\nАллергены: яйца.\n' + estimate,
    kcal: 214, protein: 14.6, fat: 14.9, carbs: 6.1,
    image: photo('spinach-omelette'), gallery: photo('spinach-omelette'), collection: 'studio-2026',
  },
  {
    title: 'Индейка с картофелем и брокколи', meal: 'Обед', kind: 'Основное', minutes: 40,
    desc: '40 минут · 1 порция · белковый обед',
    recipe: 'Ингредиенты: сырое филе грудки индейки 150 г, сырой картофель с кожурой 200 г, сырая брокколи 100 г, оливковое масло 5 г, соль и специи по вкусу.\nРазогрей духовку до 200 °C. Вымой картофель, нарежь и смешай с маслом.\nЗапекай картофель и индейку до готовности; безопасная температура внутри индейки — не ниже 74 °C. Время зависит от толщины филе.\nБрокколи приготовь на пару до желаемой мягкости. Нарежь индейку и подавай с овощами.\n' + estimate,
    kcal: 403, protein: 42.4, fat: 7.8, carbs: 41.8,
    image: photo('turkey-potatoes'), gallery: photo('turkey-potatoes'), collection: 'studio-2026',
  },
  {
    title: 'Овсянка с бананом и орехами', meal: 'Завтрак', kind: 'Основное',
    minutes: 10,
    desc: '10 минут · 1 порция · растительный завтрак',
    recipe: 'Ингредиенты: овсяные хлопья 50 г, вода 250 мл, очищенный банан 100 г, грецкие орехи 10 г.\nДоведи воду до кипения, всыпь хлопья и вари на слабом огне 5–7 минут или по инструкции на упаковке.\nНарежь банан, крупно поруби орехи.\nПереложи кашу в миску, добавь банан и орехи.\nАллергены: орехи; овёс может содержать следы глютена.\n' + estimate,
    kcal: 344, protein: 9.2, fat: 10.1, carbs: 58.1,
    image: photo('oatmeal-banana'), gallery: photo('oatmeal-banana'), collection: 'studio-2026',
  },
  {
    title: 'Киноа с нутом и цукини', meal: 'Обед', kind: 'Основное',
    minutes: 25,
    desc: '25 минут · 1 порция · растительное блюдо',
    recipe: 'Ингредиенты: сухая киноа 50 г, готовый нут без жидкости 80 г, цукини 100 г, помидоры черри 80 г, оливковое масло 5 г, петрушка, соль по вкусу.\nПромой киноа, залей водой по инструкции на упаковке и вари примерно 15 минут.\nНарежь цукини и обжарь на масле 5–7 минут, помешивая.\nДобавь готовый нут и половинки черри, прогрей 2–3 минуты.\nСмешай с киноа, добавь петрушку и подавай тёплым.\n' + estimate,
    kcal: 391, protein: 16.1, fat: 10.6, carbs: 60.2,
    image: photo('quinoa-chickpeas'), gallery: photo('quinoa-chickpeas'), collection: 'studio-2026',
  },
  {
    title: 'Лосось со спаржей', meal: 'Ужин', kind: 'Основное',
    minutes: 25,
    desc: '25 минут · 1 порция · запекание',
    recipe: 'Ингредиенты: филе лосося 150 г, спаржа 150 г, оливковое масло 5 г, лимон 15 г, соль и перец по вкусу.\nРазогрей духовку до 200 °C. Удали жёсткие основания спаржи.\nВыложи рыбу и спаржу в форму, смажь маслом, приправь.\nЗапекай около 15–20 минут до готовности рыбы; время зависит от толщины филе.\nПодавай с долькой лимона.\nАллергены: рыба.\n' + estimate,
    kcal: 391, protein: 34.1, fat: 25.4, carbs: 7.2,
    image: photo('salmon-asparagus'), gallery: photo('salmon-asparagus'), collection: 'studio-2026',
  },
  {
    title: 'Йогурт с ягодами и миндалём', meal: 'Завтрак', kind: 'Десерт',
    minutes: 5,
    desc: '5 минут · 1 порция · без приготовления',
    recipe: 'Ингредиенты: натуральный греческий йогурт 2% 170 г, голубика 40 г, клубника 40 г, миндальные лепестки 10 г.\nПромой ягоды, удали чашелистики клубники и разрежь ягоды пополам.\nПереложи йогурт в миску, добавь ягоды и миндаль.\nПодавай сразу.\nАллергены: молоко, миндаль.\n' + estimate,
    kcal: 218, protein: 19.6, fat: 8.5, carbs: 17.7,
    image: photo('yogurt-berries'), gallery: photo('yogurt-berries'), collection: 'studio-2026',
  },
];

/** Saved/custom versions win on identity; additions remain dayless until selected. */
export function withDiningCollection(id: string, rows: Dish[]): Dish[] {
  if (id !== 'nutrition-month') return rows;
  const keys = new Set(rows.map((row) => `${row.meal}¦${row.title}`));
  return [...rows, ...DINING_COLLECTION.filter((row) => !keys.has(`${row.meal}¦${row.title}`))];
}

export const diningPreview = (src: string) => src.startsWith('/food/studio/')
  ? src.replace('/studio/', '/studio/thumbs/') : src;
