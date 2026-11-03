import { test, expect } from '@playwright/test';

test('manual calories survive reload and a food diary update', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/health');
  const calorieInput = page.getByPlaceholder('ккал', {exact:true});
  await calorieInput.fill('1850');
  await calorieInput.press('Enter');
  await expect(page.getByText('1 850 ккал сегодня')).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 850 ккал сегодня')).toBeVisible();
  await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify({[date]:[{key:'test',title:'Обед',meal:'Обед',kcal:400}]}));
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
  });
  await page.waitForTimeout(600);
  await expect(page.getByText('1 850 ккал сегодня')).toBeVisible();
  await page.reload();
  await expect(page.getByText('1 850 ккал сегодня')).toBeVisible();
});

test('diary-owned calories update and are removed when its last entry is removed', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/health');
  const input = page.getByPlaceholder('ккал', {exact:true});
  const card = input.locator('..').locator('..');
  const updateDiary = async (kcal: number | null) => page.evaluate((value) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const items = value === null ? [] : [{key:'test',title:'Обед',meal:'Обед',kcal:value}];
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify({[date]:items}));
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
  }, kcal);
  await updateDiary(400);
  await expect(card.getByText('400 ккал сегодня')).toBeVisible();
  await page.reload();
  await expect(card.getByText('400 ккал сегодня')).toBeVisible();
  await updateDiary(600);
  await expect(card.getByText('600 ккал сегодня')).toBeVisible();
  await updateDiary(null);
  await expect(card.getByText('нет записи')).toBeVisible();
});

test('incomplete calorie diary does not create a false zero health value', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/health');
  const card = page.getByPlaceholder('ккал', {exact:true}).locator('..').locator('..');
  const setDiary = (items: object[]) => page.evaluate((entries) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify({[date]:entries}));
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
  }, items);
  await setDiary([{key:'known', title:'Обед', meal:'Обед', kcal:400}]);
  await expect(card.getByText('400 ккал сегодня')).toBeVisible();
  await setDiary([{key:'known', title:'Обед', meal:'Обед', kcal:400}, {key:'unknown', title:'Суп', meal:'Обед'}]);
  await expect(card.getByText('нет записи')).toBeVisible();
  await page.reload();
  await expect(card.getByText('нет записи')).toBeVisible();
  await setDiary([{key:'zero', title:'Вода', meal:'Другое', kcal:0}]);
  await expect(card.getByText('0 ккал сегодня')).toBeVisible();
  const input = page.getByPlaceholder('ккал', {exact:true});
  await input.fill('1800');
  await input.press('Enter');
  await expect(card.getByText('1 800 ккал сегодня')).toBeVisible();
  await setDiary([{key:'unknown', title:'Суп', meal:'Обед'}]);
  await page.waitForTimeout(500);
  await expect(card.getByText('1 800 ккал сегодня')).toBeVisible();
});

test('corrupt diary and workout data do not erase previously synced health values', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/health');
  const calories = page.getByPlaceholder('ккал', {exact:true}).locator('..').locator('..');
  const workout = page.getByPlaceholder('мин', {exact:true}).locator('..').locator('..');
  await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify({[date]:[{key:'x', title:'Обед', meal:'Обед', kcal:400}]}));
    localStorage.setItem('workout.sessions.v1', JSON.stringify({[date]:600}));
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
    window.dispatchEvent(new CustomEvent('thedad:activity-changed'));
  });
  await expect(calories.getByText('400 ккал сегодня')).toBeVisible();
  await expect(workout.getByText('10 мин сегодня')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('nutrition.eaten.v1', '{broken');
    localStorage.setItem('workout.sessions.v1', '{broken');
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
    window.dispatchEvent(new CustomEvent('thedad:activity-changed'));
  });
  await page.waitForTimeout(600);
  await expect(calories.getByText('400 ккал сегодня')).toBeVisible();
  await expect(workout.getByText('10 мин сегодня')).toBeVisible();
  await page.reload();
  await expect(calories.getByText('400 ккал сегодня')).toBeVisible();
  await expect(workout.getByText('10 мин сегодня')).toBeVisible();
});

test('manual workout minutes are not replaced by workout sessions', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/health');
  const input = page.getByPlaceholder('мин', {exact:true});
  const card = input.locator('..').locator('..');
  await input.fill('45');
  await input.press('Enter');
  await expect(card.getByText('45 мин сегодня')).toBeVisible();
  await page.evaluate(() => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    localStorage.setItem('workout.sessions.v1', JSON.stringify({[date]:600}));
    window.dispatchEvent(new CustomEvent('thedad:activity-changed'));
  });
  await page.waitForTimeout(600);
  await expect(card.getByText('45 мин сегодня')).toBeVisible();
  await page.reload();
  await expect(card.getByText('45 мин сегодня')).toBeVisible();
});

test('workout-owned minutes are updated until edited manually', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/health');
  const input = page.getByPlaceholder('мин', {exact:true});
  const card = input.locator('..').locator('..');
  const setSession = async (seconds: number) => page.evaluate((value) => {
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    localStorage.setItem('workout.sessions.v1', JSON.stringify({[date]:value}));
    window.dispatchEvent(new CustomEvent('thedad:activity-changed'));
  }, seconds);
  await setSession(600);
  await expect(card.getByText('10 мин сегодня')).toBeVisible();
  await page.reload();
  await setSession(1200);
  await expect(card.getByText('20 мин сегодня')).toBeVisible();
  await input.fill('20');
  await input.press('Enter');
  await setSession(1800);
  await page.waitForTimeout(600);
  await expect(card.getByText('20 мин сегодня')).toBeVisible();
});
