import { createCipheriv, randomBytes } from 'node:crypto';
import { test, expect } from '@playwright/test';

test('a day without content is not presented as a completed rest day', async ({ page }) => {
  const key = randomBytes(32), iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const pack = { schema: 'thedad.program/v1', id: 'empty-program', title: 'Программа', emoji: '🎯', duration_days: 1, days: [] };
  const ct = Buffer.concat([cipher.update(JSON.stringify(pack)), cipher.final(), cipher.getAuthTag()]);
  await page.addInitScript((key64) => {
    localStorage.setItem('onboarding.done.v1', '1');
    localStorage.setItem('marketplace.licenses.v1', JSON.stringify({ 'empty-program': key64 }));
  }, key.toString('base64'));
  await page.route('**/marketplace/empty-program.pack', route => route.fulfill({ json: { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64') } }));
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:program-open', { detail: { id: 'empty-program' } })));
  await expect(page.getByText('Для этого дня материалы пока не добавлены.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Отметить день выполненным' })).toBeDisabled();
  expect(await page.evaluate(() => localStorage.getItem('program.progress.v1'))).toBeNull();
});
