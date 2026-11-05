import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

test.use({ trace: 'off', screenshot: 'off', video: 'off' });

test('the published local program displays its documented meal', async ({ page }) => {
  test.skip(!existsSync('secrets/pack-keys.json'), 'Requires the local program key; not part of CI');
  const key = JSON.parse(readFileSync('secrets/pack-keys.json', 'utf8'))['weight-loss-8w'];
  test.skip(typeof key !== 'string', 'Local key for this program is unavailable');
  await page.addInitScript((contentKey) => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('marketplace.licenses.v1', JSON.stringify({ 'weight-loss-8w': contentKey }));
  }, key);
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:program-open', { detail: { id: 'weight-loss-8w' } })));
  const meal = page.getByRole('button', { name: /Овсянка с бананом и орехами/ });
  await expect(meal).toBeVisible();
  await expect(meal).toContainText('344 ккал');
  await expect(meal).toContainText('Б 9.2 · Ж 10.1 · У 58.1 г');
  const image = meal.locator('img');
  await expect(image).toHaveAttribute('src', '/food/studio/oatmeal-banana.webp');
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
  await meal.click();
  await expect(page.getByText(/овсяные хлопья 50 г/)).toBeVisible();
  await expect(page.getByText(/USDA FoodData Central/)).toBeVisible();
});
