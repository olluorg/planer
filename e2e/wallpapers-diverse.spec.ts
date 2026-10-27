import { test, expect } from '@playwright/test';
import { DIVERSE_WALLPAPERS } from '../src/lib/wallpapers';

test('new wallpaper previews and full images load, and selection persists', async ({ page, request }) => {
  for (const wall of DIVERSE_WALLPAPERS) {
    for (const path of [wall.src, wall.preview]) {
      const response = await request.get(path);
      expect(response.status(), path).toBe(200);
      expect(response.headers()['content-type']).toContain('image/webp');
    }
  }
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('theme', 'glass');
  });
  await page.goto('/settings');
  for (const title of ['Город над облаками', 'Токио после дождя', 'Белая тишина', 'Чёрный монолит']) {
    const button = page.getByRole('button', { name: title, exact: true });
    await expect(button).toBeVisible();
    await expect.poll(() => button.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  }
  await page.getByRole('button', { name: 'Токио после дождя', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Токио после дождя', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(page.getByRole('button', { name: 'Токио после дождя', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('app.wallpaper.v1'))).toContain('/diverse-2026-10/02-tokyo-rain.webp');
});
