import { test, expect, _electron as electron } from '@playwright/test';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DEFAULT_LAYOUT } from '../src/lib/dashboardPresets';

// Optional network and packaged-Windows check; uses an isolated temporary profile.
test('packaged app restores a task place and opens its real map', async ({}, testInfo) => {
  const executablePath = path.resolve('release/win-unpacked/THEDAD.exe');
  test.skip(process.env.PLANER_LIVE_MAP !== '1' || process.platform !== 'win32' || !existsSync(executablePath), 'Requires an unpacked Windows build and PLANER_LIVE_MAP=1');
  test.setTimeout(90_000);
  const tempRoot = path.resolve(tmpdir());
  const profile = await mkdtemp(path.join(tempRoot, 'thedad-place-test-'));
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
  const quit = async () => {
    if (!app) return;
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await app.close().catch(() => {});
    app = undefined;
  };
  try {
    app = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`] });
    let window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.evaluate(() => localStorage.setItem('onboarding.done.v1', '1'));
    await window.goto('app://planer/tasks');
    await window.getByPlaceholder('Новая задача...').fill('Проверка карты');
    await window.getByPlaceholder('Новая задача...').press('Enter');
    await window.getByRole('button', { name: 'Место задачи: Проверка карты' }).click();
    const dialog = window.getByRole('dialog', { name: 'Место: Проверка карты' });
    await dialog.getByLabel('Место или адрес').fill('Библиотека');
    await dialog.getByLabel('Широта').fill('55.75');
    await dialog.getByLabel('Долгота').fill('37.62');
    await dialog.getByRole('button', { name: 'Сохранить место' }).click();
    await expect(dialog).toHaveCount(0);
    await window.evaluate((ids) => {
      localStorage.setItem('dashboard.screens.v1', JSON.stringify([{ id: 'places-live', name: 'Карта', hidden: ids, layout: [{ i: 'places', x: 0, y: 0, w: 6, h: 10 }] }]));
      localStorage.setItem('dashboard.activeScreen.v1', 'places-live');
    }, DEFAULT_LAYOUT.map(item => item.i));
    await quit();
    app = await electron.launch({ executablePath, args: [`--user-data-dir=${profile}`] });
    window = await app.firstWindow();
    let tileRequests = 0;
    window.on('request', request => { if (request.url().startsWith('https://tile.openstreetmap.org/')) tileRequests++; });
    await window.goto('app://planer/');
    const widget = window.getByRole('region', { name: 'Места задач' });
    await expect(widget).toContainText('Библиотека');
    expect(tileRequests).toBe(0);
    await widget.getByRole('button', { name: 'На карте' }).click();
    const map = widget.getByLabel('Карта мест');
    await expect.poll(() => map.locator('img.leaflet-tile-loaded').evaluateAll(images => images.some(image => (image as HTMLImageElement).naturalWidth > 0)), { timeout: 20000 }).toBe(true);
    await expect(map.locator('.leaflet-popup')).toContainText('Проверка карты');
    await expect(map.locator('.leaflet-control-attribution')).toContainText('OpenStreetMap');
    expect(tileRequests).toBeGreaterThan(0);
    await widget.screenshot({ path: testInfo.outputPath('desktop-map.png') });
    const initialHeight = (await map.boundingBox())!.height;
    expect(initialHeight).toBeGreaterThan(300);
    await widget.evaluate(element => { element.style.height = '400px'; });
    await expect.poll(async () => (await map.boundingBox())?.height ?? 0).toBeLessThan(initialHeight - 40);
    await expect(map.locator('.leaflet-popup')).toContainText('Проверка карты');
    await expect.poll(async () => {
      const bounds = await map.boundingBox();
      const marker = await map.locator('.leaflet-interactive').first().boundingBox();
      return Boolean(bounds && marker && marker.x >= bounds.x && marker.y >= bounds.y && marker.x <= bounds.x + bounds.width && marker.y <= bounds.y + bounds.height);
    }).toBe(true);
  } finally {
    await quit();
    // Only remove the exact temporary profile created above, within the temp directory.
    if (path.dirname(path.resolve(profile)) === tempRoot && path.basename(profile).startsWith('thedad-place-test-')) {
      await rm(profile, { recursive: true, force: true });
    }
  }
});
