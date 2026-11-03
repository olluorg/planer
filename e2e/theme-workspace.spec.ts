import { test, expect } from '@playwright/test';

test('first visit plays the bundled video locally', async ({ page }) => {
  await page.goto('/');
  expect(await page.evaluate(() => localStorage.getItem('accent'))).toBe('graphite');
  const video = page.locator('video[src="/backgrounds/motion/city-fog.mp4"]');
  await expect(video).toHaveCount(1);
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThan(1);
  await expect(page.locator('html')).toHaveClass(/live-wp/);
});

test('an existing user without an accent retains the original default', async ({page}) => {
  await page.addInitScript(() => { localStorage.setItem('theme', 'glass'); localStorage.setItem('onboarding.done.v1', '1'); });
  await page.goto('/');
  expect(await page.evaluate(() => localStorage.getItem('accent'))).toBeNull();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#6366f1');
});

test('first visit starts glass with local motion and respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveClass(/glass/);
  await expect(page.locator('html')).not.toHaveClass(/live-wp/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('app.livewallpaper.v1')!).kind)).toBe('builtin');
  await page.getByRole('button', { name: 'Пропустить' }).click();
  await expect(page.getByRole('heading', { name: 'Пока ничего не запланировано' })).toBeVisible();
  await expect(page.getByText('Ты на правильном пути')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Пока ничего не запланировано' })).toBeVisible();
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Город над облаками', exact: true }).click();
  expect(await page.evaluate(() => localStorage.getItem('app.livewallpaper.v1'))).toBeNull();
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem('app.livewallpaper.v1'))).toBeNull();
});

test('workspace is separate, survives reload and keeps glass selectable', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('onboarding.done.v1', '1'); if (!localStorage.getItem('theme')) localStorage.setItem('theme', 'dark'); });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Workspace', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/work/);
  await page.reload();
  await expect(page.locator('html')).toHaveClass(/work/);
  await page.getByRole('button', { name: 'Светлая', exact: true }).last().click();
  await expect(page.locator('html')).toHaveClass(/work-light/);
  await page.getByRole('button', { name: 'Glass', exact: true }).click();
  await expect(page.locator('html')).toHaveClass(/glass/);
  await expect(page.locator('html')).not.toHaveClass(/work/);
});

test('workspace has its own quiet accent and preserves colours selected in other themes', async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem('onboarding.done.v1','1'); if (!localStorage.getItem('theme')) localStorage.setItem('theme','dark'); if (!localStorage.getItem('accent')) localStorage.setItem('accent','purple');});
  await page.goto('/settings');
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#405e4a');
  expect(await page.evaluate(() => localStorage.getItem('accent'))).toBe('purple');
  await page.getByTitle('Океан', {exact:true}).click();
  expect(await page.evaluate(() => localStorage.getItem('accent.workspace.v1'))).toBe('ocean');
  await page.getByRole('button',{name:'Glass',exact:true}).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#6366f1');
  await page.getByRole('button',{name:'Workspace',exact:true}).click();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#4e8f9e');
  await page.reload();
  await expect.poll(() => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim())).toBe('#4e8f9e');
});

test('workspace active navigation remains legible with the default accent', async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem('onboarding.done.v1','1'); localStorage.setItem('theme','work');});
  await page.goto('/');
  const link = page.locator('nav[aria-label="Основные разделы"] a[aria-current="page"]');
  const ratio = await link.evaluate(el => {
    const channel = (n:number) => {const c=n/255; return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
    const canvas=document.createElement('canvas'); canvas.width=1; canvas.height=1; const ctx=canvas.getContext('2d')!;
    const lum = (color:string) => {ctx.clearRect(0,0,1,1); ctx.fillStyle=color; ctx.fillRect(0,0,1,1); const v=ctx.getImageData(0,0,1,1).data;return .2126*channel(v[0])+.7152*channel(v[1])+.0722*channel(v[2]);};
    const fg=lum(getComputedStyle(el).color), bg=lum(getComputedStyle(document.body).backgroundColor);
    return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test('workspace empty state offers working actions at desktop and mobile widths', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('onboarding.done.v1', '1'); localStorage.setItem('theme', 'work'); });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Сегодня', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пока ничего не запланировано' })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть календарь' }).click();
  await expect(page).toHaveURL(/\/calendar$/);
});

test('day summary shows actual task totals instead of an unsupported prediction', async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem('onboarding.done.v1','1');localStorage.setItem('theme','work');});
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Проверить документ');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await page.goto('/');
  await expect(page.getByText('Задач на сегодня: 1. Выполнено: 0.')).toBeVisible();
  await expect(page.getByText(/за неделю выполнено:/)).toContainText('0 из 1');
  await expect(page.getByText('Высокий шанс выиграть день. Начни с главного.')).toHaveCount(0);
});

test('focus card starts focus with its task rather than a stale selection', async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem('onboarding.done.v1','1');localStorage.setItem('theme','work');});
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Работа над проектом');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await page.evaluate(() => localStorage.setItem('focus.session.v1', JSON.stringify({running:false,phase:'work',pomodoro:true,cycleIdx:0,timerIdx:0,selectedId:'old-task',endsAt:null,secondsLeft:1500})));
  await page.goto('/');
  const card=page.locator('[data-widget="today-focus"]');
  await expect(card).toContainText('Работа над проектом');
  await expect(card).toContainText('нет активных целей');
  await card.getByRole('button',{name:'Начать фокус'}).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('focus.session.v1') || '{}').selectedId)).not.toBe('old-task');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('focus.session.v1') || '{}').selectedId)).toBeTruthy();
});
