import { test, expect } from '@playwright/test';

test('disabling scheduled notifications does not reload the app', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('thedad.heartbeat.enabled.v1', '1');
  });
  await page.goto('/settings');
  const toggle = page.getByRole('switch', { name: 'Утренние и вечерние уведомления' });
  await expect(toggle).toHaveAttribute('aria-checked', 'true');
  await page.evaluate(() => { (window as any).__heartbeatMarker = 'same-page'; });
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => (window as any).__heartbeatMarker)).toBe('same-page');
  expect(await page.evaluate(() => localStorage.getItem('thedad.heartbeat.enabled.v1'))).toBe('0');
});
