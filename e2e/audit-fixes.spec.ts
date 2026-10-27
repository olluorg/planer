import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
});

test('theme is consistent on first launch and persists after switching', async ({ page }) => {
  await page.goto('/settings');
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Светлая', exact: true }).click();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator('html')).not.toHaveClass(/dark/);
});

test('goal creation remains reachable at 320 and 390 pixels', async ({ page }) => {
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/goals');
    const button = page.getByRole('button', { name: 'Новая цель', exact: true }).first();
    await expect(button).toBeVisible();
    const box = (await button.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await button.click();
    await expect(page.getByPlaceholder('Название')).toBeVisible();
  }
});

test('more navigation opens a section and closes with Escape', async ({ page }) => {
  await page.goto('/');
  const menu = page.locator('details:visible').filter({ has: page.locator('summary', { hasText: 'Ещё' }) });
  await menu.locator('summary').click();
  await expect(menu.getByRole('link', { name: 'Привычки', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  await menu.locator('summary').click();
  await menu.getByRole('link', { name: 'Привычки', exact: true }).click();
  await expect(page).toHaveURL(/\/habits$/);
});

test.describe('offline routes', () => {
  test.use({ serviceWorkers: 'allow' });
  test('unvisited sections load offline after the first installation', async ({ page, context }) => {
    await page.goto('/');
    await page.evaluate(async () => { await navigator.serviceWorker.ready; });
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    for (const [route, heading] of [['/calendar', 'Календарь'], ['/goals', 'Мои цели'], ['/analytics', 'Аналитика']]) {
      await page.goto(route);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByText('Что-то сломалось')).toHaveCount(0);
      await expect(page.locator('main')).not.toBeEmpty();
    }
  });
});
