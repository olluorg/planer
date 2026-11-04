import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

test('personal data exports without credentials, restores, and can be rolled back', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1', '1');
    if (localStorage.getItem('personal.fixture')) return;
    localStorage.setItem('personal.fixture','1');
    localStorage.setItem('user.name.v1','Анна');
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify({'2026-10-29':[{key:'a',title:'Обед',meal:'Обед',kcal:400,protein:20}]}));
    localStorage.setItem('hub.photos.home-gym', JSON.stringify({ before: 'data:image/jpeg;base64,YWJj' }));
    localStorage.setItem('hub.goals.home-gym', JSON.stringify(['Сила']));
    localStorage.setItem('program.installed.v1', JSON.stringify([{id:'home-gym',title:'Зал',emoji:'🏋️',kind:'hub'}]));
    localStorage.setItem('program.progress.v1', JSON.stringify({'home-gym':{start:'2026-11-01',done:[1,3]}}));
    localStorage.setItem('thedad.drive.pass','example-secret');
  });
  await page.goto('/health');
  await page.getByPlaceholder('ккал', {exact:true}).fill('1850');
  await page.getByPlaceholder('ккал', {exact:true}).press('Enter');
  await page.goto('/settings');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name:'Экспорт личных данных'}).click();
  const downloaded = await pending;
  const contents = await fs.readFile((await downloaded.path())!);
  expect(contents.toString()).not.toContain('example-secret');
  await page.evaluate(() => {localStorage.setItem('user.name.v1','Иван'); localStorage.removeItem('nutrition.eaten.v1'); localStorage.removeItem('hub.photos.home-gym'); localStorage.setItem('hub.goals.home-gym', '["Другие"]'); localStorage.removeItem('program.installed.v1'); localStorage.setItem('program.progress.v1','{}');});
  page.once('dialog', dialog => dialog.accept());
  const reloaded = page.waitForEvent('load');
  await page.getByText('Копия личных данных', {exact:true}).locator('..').locator('input[type=file]').setInputFiles({name:'personal.json',mimeType:'application/json',buffer:contents});
  await reloaded;
  expect(await page.evaluate(() => localStorage.getItem('user.name.v1'))).toBe('Анна');
  expect(await page.evaluate(() => localStorage.getItem('nutrition.eaten.v1'))).toContain('Обед');
  expect(await page.evaluate(() => localStorage.getItem('hub.photos.home-gym'))).toContain('data:image/jpeg;base64,YWJj');
  expect(await page.evaluate(() => localStorage.getItem('hub.goals.home-gym'))).toBe('["Сила"]');
  expect(await page.evaluate(() => localStorage.getItem('program.progress.v1'))).toContain('2026-11-01');
  expect(await page.evaluate(() => localStorage.getItem('program.installed.v1'))).toContain('home-gym');
  expect(await page.evaluate(() => localStorage.getItem('thedad.drive.pass'))).toBe('example-secret');
  await page.goto('/health');
  await expect(page.getByText('1 850 ккал сегодня')).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByRole('button', {name:'Вернуть данные до импорта'})).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  const rollback = page.waitForEvent('load');
  await page.getByRole('button', {name:'Вернуть данные до импорта'}).click();
  await rollback;
  expect(await page.evaluate(() => localStorage.getItem('user.name.v1'))).toBe('Иван');
  expect(await page.evaluate(() => localStorage.getItem('nutrition.eaten.v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('hub.photos.home-gym'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('hub.goals.home-gym'))).toBe('["Другие"]');
  expect(await page.evaluate(() => localStorage.getItem('program.installed.v1'))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem('program.progress.v1'))).toBe('{}');
});

test('invalid personal backup is rejected without changing local data', async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem('onboarding.done.v1','1'); localStorage.setItem('user.name.v1','Сохранить');});
  await page.goto('/settings');
  const card = page.getByText('Копия личных данных', {exact:true}).locator('..');
  await card.locator('input[type=file]').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{"schema":"thedad.personal-data/v1","values":{}}')});
  await expect(page.getByText('Не удалось восстановить личные данные', {exact:true})).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('user.name.v1'))).toBe('Сохранить');
});

test('personal import does not overwrite data when the database cannot be saved', async ({page}) => {
  await page.addInitScript(() => { localStorage.setItem('onboarding.done.v1', '1'); localStorage.setItem('user.name.v1', 'До импорта'); });
  await page.goto('/settings');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Экспорт личных данных' }).click();
  const contents = await fs.readFile((await (await download).path())!);
  await page.evaluate(() => {
    localStorage.setItem('user.name.v1', 'Текущее имя');
    const original = IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction = function (...args) {
      if (args[1] === 'readwrite') throw new Error('test storage failure');
      return original.apply(this, args);
    };
  });
  page.once('dialog', dialog => dialog.accept());
  const input = page.getByText('Копия личных данных', { exact: true }).locator('..').locator('input[type=file]');
  await input.setInputFiles({ name: 'personal.json', mimeType: 'application/json', buffer: contents });
  await expect(page.getByText('Не удалось восстановить личные данные', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('user.name.v1'))).toBe('Текущее имя');
});

test('damaged personal data can still be exported as a raw recovery copy', async ({page}) => {
  await page.addInitScript(() => {
    localStorage.setItem('onboarding.done.v1','1');
    localStorage.setItem('nutrition.eaten.v1','{broken');
    localStorage.setItem('thedad.drive.pass','private-secret');
  });
  await page.goto('/settings');
  const pending = page.waitForEvent('download');
  await page.getByRole('button', {name:'Экспорт личных данных'}).click();
  const contents = await fs.readFile((await (await pending).path())!, 'utf8');
  expect(contents).not.toContain('private-secret');
  expect(JSON.parse(contents).values['nutrition.eaten.v1']).toBe('{broken');
  await expect(page.getByText('Сохранена исходная копия с повреждёнными данными')).toBeVisible();
});
