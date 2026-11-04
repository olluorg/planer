import { test, expect } from '@playwright/test';

for (const [eventName, id] of [['thedad:workout-hub', 'home-gym'], ['thedad:program-open', 'weight-loss-8w']]) {
  test(`restored ${id} offers license activation without reinstalling`, async ({ page }) => {
    await page.addInitScript(({ id }) => {
      localStorage.setItem('onboarding.done.v1', '1');
      localStorage.setItem('program.installed.v1', JSON.stringify([{ id, title: 'Программа', emoji: '🎯', kind: id === 'home-gym' ? 'hub' : 'program' }]));
      localStorage.setItem('program.progress.v1', JSON.stringify({ [id]: { start: '2026-11-01', done: [1, 3] } }));
    }, { id });
    await page.goto('/');
    await expect(page.locator('main')).toBeVisible();
    await page.evaluate(({ eventName, id }) => window.dispatchEvent(new CustomEvent(eventName, { detail: { id } })), { eventName, id });
    await expect(page.getByText('Для открытия программы активируйте её лицензионный ключ.')).toBeVisible();
    await page.getByRole('button', { name: 'Открыть программы и ввести ключ' }).click();
    await expect(page.getByRole('button', { name: 'Есть ключ' })).toBeVisible();
    await page.getByRole('button', { name: 'Есть ключ' }).click();
    await expect(page.getByPlaceholder('THEDAD-...')).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('program.progress.v1'))).toContain('"done":[1,3]');
  });
}

test('unconfigured purchases do not lead to placeholder payment pages', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:marketplace')));
  await expect(page.getByText('Покупка пока недоступна').first()).toBeVisible();
  await expect(page.locator('a[href*="CHANGE_ME"]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Есть ключ' })).toBeVisible();
});

test('catalog loading errors can be retried without hiding license activation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  let requests = 0;
  await page.route('**/marketplace/catalog.json', async (route) => {
    requests++;
    if (requests === 1) await route.fulfill({ status: 503 });
    else await route.continue();
  });
  await page.goto('/');
  await expect(page.locator('main')).toBeVisible();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('thedad:marketplace')));
  await expect(page.getByRole('alert').filter({ hasText: 'Не удалось загрузить программы' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Есть ключ' })).toBeVisible();
  await page.getByRole('button', { name: 'Повторить' }).click();
  await expect(page.getByText('Покупка пока недоступна').first()).toBeVisible();
});
