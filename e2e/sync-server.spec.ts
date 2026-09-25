import { test, expect, type Browser, type Page } from '@playwright/test';

/** Два устройства через настоящий sync-сервер (deploy/server в Docker).
 *  Нужен поднятый сервер и сборка с Plus:
 *    VITE_FEATURE_PLUS=1 VITE_SYNC_SERVER_URL=https://localhost bun run build
 *    E2E_SYNC_SERVER=https://localhost npx playwright test e2e/sync-server.spec.ts
 *  Без E2E_SYNC_SERVER тест пропускается — в обычном CI сервера нет. */
const SERVER = process.env.E2E_SYNC_SERVER;
test.skip(!SERVER, 'нужен запущенный sync-сервер: E2E_SYNC_SERVER=https://…');
test.use({ ignoreHTTPSErrors: true }); // локальный сертификат Caddy

async function device(browser: Browser): Promise<Page> {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  return page;
}

async function addGoal(page: Page, title: string) {
  await page.goto('/goals');
  await page.getByRole('button', { name: 'Новая цель' }).first().click();
  await page.getByPlaceholder('Название').fill(title);
  await page.getByPlaceholder('Старт').fill('0');
  await page.getByPlaceholder('Цель', { exact: true }).fill('10');
  await page.getByRole('button', { name: 'Создать' }).click();
  await expect(page.getByText(title).first()).toBeVisible();
}

async function connect(page: Page, email: string, mode: 'Регистрация' | 'Войти') {
  await page.goto('/settings');
  await page.getByPlaceholder('email').fill(email);
  await page.getByPlaceholder('пароль').fill('password123');
  await page.getByRole('button', { name: mode }).click();
  await expect(page.getByText(/Подключено/)).toBeVisible({ timeout: 15_000 });
}

async function sync(page: Page) {
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Синхронизировать' }).click();
  await expect(page.getByText('Синхронизировано').first()).toBeVisible({ timeout: 15_000 });
}

test('правки с двух устройств сливаются без потерь', async ({ browser }) => {
  const email = `e2e-${Date.now()}@example.com`;
  const laptop = await device(browser);
  const phone = await device(browser);

  await addGoal(laptop, 'С ноутбука');
  await connect(laptop, email, 'Регистрация');

  // Телефон уже чем-то пользовался до входа — это не должно пропасть.
  await addGoal(phone, 'С телефона до входа');
  await connect(phone, email, 'Войти');
  await phone.goto('/goals');
  await expect(phone.getByText('С ноутбука').first()).toBeVisible();
  await expect(phone.getByText('С телефона до входа').first()).toBeVisible();

  // Оба правят «офлайн» (без синка), потом синхронизируются.
  await addGoal(laptop, 'Ноутбук, вечер');
  await addGoal(phone, 'Телефон, вечер');
  await sync(phone);
  await sync(laptop);

  await laptop.goto('/goals');
  for (const t of ['С ноутбука', 'С телефона до входа', 'Ноутбук, вечер', 'Телефон, вечер']) {
    await expect(laptop.getByText(t).first()).toBeVisible();
  }
});
