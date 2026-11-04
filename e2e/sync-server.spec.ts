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
  // Hold the completed background PUT response: phone changes the server
  // while laptop still considers that older exchange in flight.
  let release!: () => void;
  let captured!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const responseCaptured = new Promise<void>((resolve) => { captured = resolve; });
  let held = false;
  await laptop.route('**/vault/*', async (route) => {
    if (!held && route.request().method() === 'PUT') {
      held = true;
      const response = await route.fetch();
      captured();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  try {
    await laptop.goto('/settings');
    await Promise.race([responseCaptured, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Фоновая синхронизация не началась')), 15_000))]);
    await sync(phone);
    await laptop.getByRole('button', { name: 'Синхронизировать' }).click();
    release();
    await expect(laptop.getByText('Синхронизировано').first()).toBeVisible({ timeout: 15_000 });
  } finally {
    release();
    await laptop.unroute('**/vault/*');
  }

  await laptop.goto('/goals');
  for (const t of ['С ноутбука', 'С телефона до входа', 'Ноутбук, вечер', 'Телефон, вечер']) {
    await expect(laptop.getByText(t).first()).toBeVisible();
  }
});

test('сервер атомарно отклоняет устаревшую и старую запись', async ({ request }) => {
  const created = await request.post(`${SERVER}/vault`);
  expect(created.ok()).toBeTruthy();
  const { syncId, authToken } = await created.json();
  const url = `${SERVER}/vault/${syncId}`;
  const headers = { Authorization: `Bearer ${authToken}` };
  const initial = await (await request.get(url, { headers })).json();
  expect(initial.revision).toBe(0);
  const writes = await Promise.all(['first', 'second'].map(ciphertext => request.put(url, {
    headers, data: { ciphertext, expectedRevision: initial.revision },
  })));
  expect(writes.map(r => r.status()).sort()).toEqual([200, 409]);
  expect((await request.put(url, { headers, data: { ciphertext: 'legacy' } })).status()).toBe(426);
  const result = await (await request.get(url, { headers })).json();
  expect(result.revision).toBe(1);
  expect(['first', 'second']).toContain(result.ciphertext);
});

test('одновременная синхронизация объединяет изменения обоих устройств', async ({ browser }) => {
  const email = `race-${Date.now()}@example.com`;
  const laptop = await device(browser);
  const phone = await device(browser);
  await addGoal(laptop, 'Общая цель');
  await connect(laptop, email, 'Регистрация');
  await connect(phone, email, 'Войти');
  await addGoal(laptop, 'Изменение ноутбука');
  await addGoal(phone, 'Изменение телефона');

  let waiting = 0;
  let release!: () => void;
  const barrier = new Promise<void>(resolve => { release = resolve; });
  const intercept = async (route: import('@playwright/test').Route) => {
    if (route.request().method() === 'PUT' && waiting < 2) {
      if (++waiting === 2) release();
      await barrier;
    }
    await route.continue();
  };
  await laptop.route('**/vault/*', intercept);
  await phone.route('**/vault/*', intercept);
  await Promise.all([sync(laptop), sync(phone)]);
  expect(waiting).toBe(2);
  await laptop.unroute('**/vault/*', intercept);
  await phone.unroute('**/vault/*', intercept);
  await sync(laptop);
  await sync(phone);
  for (const page of [laptop, phone]) {
    await page.goto('/goals');
    for (const title of ['Общая цель', 'Изменение ноутбука', 'Изменение телефона']) {
      await expect(page.getByText(title).first()).toBeVisible();
    }
  }
});
