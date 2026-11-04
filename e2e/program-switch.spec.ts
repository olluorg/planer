import { randomBytes, createCipheriv } from 'node:crypto';
import { test, expect } from '@playwright/test';

for (const eventName of ['thedad:program-open', 'thedad:workout-hub']) {
  for (const oldResponse of ['success', 'error']) {
    test(`${eventName} ignores a delayed ${oldResponse} from the previous program`, async ({ page }) => {
      const key = randomBytes(32);
      const pack = (id: string, title: string) => {
        const iv = randomBytes(12);
        const cipher = createCipheriv('aes-256-gcm', key, iv);
        const payload = JSON.stringify({ schema: 'thedad.program/v1', id, title, emoji: '🎯', duration_days: 1, days: [], hub: { headline: title, sessions: [] } });
        const ciphertext = Buffer.concat([cipher.update(payload), cipher.final(), cipher.getAuthTag()]);
        return { v: 1, iv: iv.toString('base64'), ct: ciphertext.toString('base64') };
      };
      let releaseOld!: () => void;
      let oldRequested!: () => void;
      const oldPending = new Promise<void>((resolve) => { releaseOld = resolve; });
      const requested = new Promise<void>((resolve) => { oldRequested = resolve; });
      await page.addInitScript((contentKey) => {
        localStorage.setItem('onboarding.done.v1', '1');
        localStorage.setItem('marketplace.licenses.v1', JSON.stringify({ 'old-program': contentKey, 'new-program': contentKey }));
      }, key.toString('base64'));
      await page.route('**/marketplace/old-program.pack', async (route) => {
        oldRequested();
        await oldPending;
        await route.fulfill(oldResponse === 'success' ? { json: pack('old-program', 'Старая программа') } : { status: 404 });
      });
      await page.route('**/marketplace/new-program.pack', (route) => route.fulfill({ json: pack('new-program', 'Новая программа') }));
      await page.goto('/');
      await expect(page.locator('main')).toBeVisible();
      const open = (id: string) => page.evaluate(({ eventName, id }) => window.dispatchEvent(new CustomEvent(eventName, { detail: { id } })), { eventName, id });
      await open('old-program');
      await requested;
      await open('new-program');
      await expect(page.getByText('Новая программа', { exact: true })).toBeVisible();
      const oldFinished = page.waitForResponse('**/marketplace/old-program.pack');
      releaseOld();
      await oldFinished;
      await expect(page.getByText('Новая программа', { exact: true })).toBeVisible();
      await expect(page.getByText('Старая программа', { exact: true })).toHaveCount(0);
      await expect(page.getByText('Файл программы не найден')).toHaveCount(0);
    });
  }
}
