import { test, expect } from '@playwright/test';

/** Окна и виджеты грузятся по требованию — проверяем, что они всё равно
 *  открываются, а тяжёлый код не приезжает до первого открытия. */
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
});

test('магазин программ открывается и не грузится заранее', async ({ page }) => {
  const chunks: string[] = [];
  page.on('request', (r) => { if (/MarketplaceModal-.*\.js$/.test(r.url())) chunks.push(r.url()); });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect(chunks, 'код магазина загрузился до открытия').toEqual([]);

  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:marketplace')));
  await expect(page.getByText('Премиум-программы')).toBeVisible();
  expect(chunks.length).toBe(1);
});

for (const how of ['кнопкой в шапке', 'горячей клавишей'] as const) {
  test(`фокус-режим открывается ${how}`, async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    if (how === 'кнопкой в шапке') await page.getByRole('button', { name: /^Фокус/ }).first().click();
    else await page.keyboard.press('Control+Shift+F');
    await expect(page.getByRole('button', { name: 'Старт' })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('25:00')).toBeVisible();
  });
}
