import { test, expect } from '@playwright/test';
import { DEFAULT_LAYOUT } from '../src/lib/dashboardPresets';

// Optional live network smoke test; run after building with PLANER_LIVE_MAP=1.
// It uses a fictional task and coordinates, never the user's saved data.
test('real map tiles load only after opening the picker and task map', async ({ page }) => {
  test.skip(process.env.PLANER_LIVE_MAP !== '1', 'Optional network check against OpenStreetMap');
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('theme', 'work');
  });
  let requests = 0;
  let successful = 0;
  page.on('request', request => { if (request.url().startsWith('https://tile.openstreetmap.org/')) requests++; });
  page.on('response', response => { if (response.url().startsWith('https://tile.openstreetmap.org/') && response.ok()) successful++; });
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Проверка карты');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await page.getByRole('button', { name: 'Место задачи: Проверка карты' }).click();
  const dialog = page.getByRole('dialog', { name: 'Место: Проверка карты' });
  await dialog.getByLabel('Место или адрес').fill('Библиотека');
  await dialog.getByLabel('Широта').fill('55.75');
  await dialog.getByLabel('Долгота').fill('37.62');
  expect(requests).toBe(0);
  await dialog.getByRole('button', { name: 'Выбрать на карте' }).click();
  const picker = dialog.getByLabel('Выбор точки на карте');
  await expect.poll(() => successful, { timeout: 20000 }).toBeGreaterThan(0);
  await expect.poll(() => picker.locator('img.leaflet-tile-loaded').evaluateAll(images => images.some(image => (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
  await expect(picker.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
  await dialog.getByRole('button', { name: 'Сохранить место' }).click();
  await page.evaluate((ids) => {
    localStorage.setItem('dashboard.screens.v1', JSON.stringify([{ id: 'places-live', name: 'Карта', hidden: ids, layout: [{ i: 'places', x: 0, y: 0, w: 6, h: 10 }] }]));
    localStorage.setItem('dashboard.activeScreen.v1', 'places-live');
  }, DEFAULT_LAYOUT.map(item => item.i));
  await page.goto('/');
  const widget = page.getByRole('region', { name: 'Места задач' });
  await widget.getByRole('button', { name: 'На карте' }).click();
  const map = widget.getByLabel('Карта мест');
  await expect.poll(() => map.locator('img.leaflet-tile-loaded').evaluateAll(images => images.some(image => (image as HTMLImageElement).naturalWidth > 0)), { timeout: 20000 }).toBe(true);
  await expect(map.locator('.leaflet-popup')).toContainText('Проверка карты');
  await expect(map.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
});
