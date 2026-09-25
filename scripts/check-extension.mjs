/** Проверка собранного расширения в настоящем Chromium: грузится, API на месте,
 *  задача из адресной строки («td …») доходит до страницы.
 *    bun run build:ext && node scripts/check-extension.mjs */
import { chromium } from '@playwright/test';
import path from 'node:path';
const ext = path.resolve('dist');
const ctx = await chromium.launchPersistentContext('', {
  headless: true, channel: 'chromium',
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
const id = new URL(sw.url()).host;
console.log('расширение загружено, id:', id);
const errors = [];
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
await page.goto(`chrome-extension://${id}/index.html#/tasks`);
await page.waitForTimeout(2500);
// имитируем то, что делает фон при «td купить молоко»
await sw.evaluate(async () => chrome.storage.local.set({ planer_inbox: [{ title: 'Купить молоко из омнибокса', at: Date.now() }] }));
await page.waitForTimeout(2000);
const found = await page.getByText('Купить молоко из омнибокса').count();
const left = await sw.evaluate(async () => (await chrome.storage.local.get('planer_inbox')).planer_inbox);
console.log('задача появилась на странице:', found > 0, '| очередь после забора:', JSON.stringify(left));
const omni = await sw.evaluate(() => typeof chrome.omnibox?.onInputEntered?.addListener);
const ident = await sw.evaluate(() => typeof chrome.identity?.launchWebAuthFlow);
console.log('chrome.omnibox доступен:', omni === 'function', '| chrome.identity доступен:', ident === 'function');
console.log('ошибки страницы:', errors.length ? errors : 'нет');
await ctx.close();
