import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/** Пропускаем мастер первого запуска — он проверяется руками, а здесь мешает. */
async function freshApp(page: Page) {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
}

/** Собирает нарушения CSP и ошибки консоли за время теста. */
function watchErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

test('все разделы открываются без ошибок и нарушений CSP', async ({ page }) => {
  await freshApp(page);
  const errors = watchErrors(page);
  const pages = ['/', '/goals', '/tasks', '/plan', '/habits', '/calendar', '/analytics',
    '/health', '/reflection', '/history', '/awards', '/templates', '/settings'];
  for (const p of pages) {
    await page.goto(p);
    // Экран ошибки — значит упал рендер или база не открылась.
    await expect(page.getByText('Что-то сломалось')).toHaveCount(0);
    await expect(page.getByText('Не удалось открыть базу данных')).toHaveCount(0);
  }
  // Геолокация в headless отклоняется — погода честно молчит, это не ошибка.
  expect(errors.filter((e) => !/geolocation/i.test(e))).toEqual([]);
});

test('цель и прогресс переживают перезагрузку', async ({ page }) => {
  await freshApp(page);
  await page.goto('/goals');

  await page.getByRole('button', { name: 'Новая цель' }).first().click();
  await page.getByPlaceholder('Название').fill('Пробежать 10 км');
  await page.getByPlaceholder('Старт').fill('2');
  await page.getByPlaceholder('Цель', { exact: true }).fill('10');
  await page.getByPlaceholder('Ед.').fill('км');
  await page.getByRole('button', { name: 'Создать' }).click();

  await expect(page.getByText('Пробежать 10 км').first()).toBeVisible();
  // Прогноза ещё нет — вместо пустого графика должно быть объяснение.
  await expect(page.getByText(/после отметок в два разных дня/)).toBeVisible();

  await page.getByPlaceholder(/^Текущее значение/).fill('4');
  await page.getByRole('button', { name: 'Записать' }).click();
  await expect(page.getByText(/Ещё одна отметка в другой день/)).toBeVisible();

  // Запись в IndexedDB отложена на 250 мс — перезагрузка проверяет, что данные
  // не теряются на уходе со страницы (flush на pagehide).
  await page.reload();
  await expect(page.getByText('Пробежать 10 км').first()).toBeVisible();
  await expect(page.getByText(/Ещё одна отметка в другой день/)).toBeVisible();
});

test('колонка целей не схлопывается на узком экране', async ({ page }) => {
  await freshApp(page);
  await page.goto('/goals');
  const width = await page.locator('.goals-col').evaluate((el) => el.getBoundingClientRect().width);
  // Регрессия: container-type: inline-size внутри flex-column давал ширину 0.
  expect(width).toBeGreaterThan(200);
});

test('прямой заход на внутренний адрес открывает приложение', async ({ page }) => {
  await freshApp(page);
  await page.goto('/analytics');
  // Приложение смонтировалось и не упало в экран ошибки.
  await expect(page.locator('#root > *').first()).toBeVisible();
  await expect(page.getByText('Что-то сломалось')).toHaveCount(0);
});

test('в сборке есть 404.html для GitHub Pages', () => {
  // Pages отдаёт 404.html на любой неизвестный путь; без него прямая ссылка
  // thedad.ru/goals открывала страницу ошибки GitHub вместо приложения.
  const dist = path.resolve(process.cwd(), 'dist');
  expect(fs.readFileSync(path.join(dist, '404.html'), 'utf-8'))
    .toBe(fs.readFileSync(path.join(dist, 'index.html'), 'utf-8'));
});
