import { test, expect } from '@playwright/test';

test('freezing a streak updates the page without reloading', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.clock.install({ time: new Date('2026-11-15T12:00:00') });
  await page.goto('/awards');
  const button = page.getByRole('button', { name: 'Заморозить вчера' });
  await expect(button).toBeEnabled();
  await page.evaluate(() => { (window as unknown as { freezePageMarker: string }).freezePageMarker = 'same-page'; });
  await button.click();
  await expect(button).toBeDisabled();
  expect(await page.evaluate(() => (window as unknown as { freezePageMarker?: string }).freezePageMarker)).toBe('same-page');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('streak.freezes.used.v1') ?? '[]').length)).toBe(1);
});
