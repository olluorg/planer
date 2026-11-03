import { test, expect } from '@playwright/test';

test('activity balance requires a profile and a food entry', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Проверить план');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await page.goto('/');
  const widget = page.locator('[data-widget="activity"]');
  const calories = page.locator('[data-widget="calories"]');
  await expect(widget.getByText('нет данных')).toBeVisible();
  await expect(calories.getByText('баланс: нет данных')).toBeVisible();
  await expect(widget.getByText('Для оценки добавьте еду и заполните профиль.')).toBeVisible();
  await page.evaluate(() => {
    localStorage.setItem('profile.sex.v1', 'female');
    localStorage.setItem('profile.age.v1', '30');
    localStorage.setItem('profile.height.v1', '170');
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    localStorage.setItem('nutrition.eaten.v1', JSON.stringify({[date]:[{key:'meal', title:'Обед', meal:'Обед', kcal:500}]}));
    window.dispatchEvent(new CustomEvent('thedad:nutrition-changed'));
  });
  await expect(widget.getByText('нет данных')).toHaveCount(0);
  await expect(calories.getByText('баланс: нет данных')).toHaveCount(0);
  await expect(widget.getByText('По внесённым записям; неполный дневник влияет на результат.')).toBeVisible();
  await page.reload();
  await expect(widget.getByText('Расчётный баланс')).toBeVisible();
  await expect(widget.getByText('нет данных')).toHaveCount(0);
});

test('manual activity form remains open when storage is full', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Тест активности');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await expect(page.getByText('Тест активности', {exact:true})).toBeVisible();
  await page.goto('/');
  const widget = page.locator('[data-widget="activity"]');
  await widget.getByRole('button', {name:'Добавить тренировку'}).click();
  await widget.getByPlaceholder('мин').fill('25');
  await page.evaluate(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'activity.manual.v1') throw new DOMException('Storage full', 'QuotaExceededError');
      return original.call(this, key, value);
    };
  });
  await widget.getByPlaceholder('мин').press('Enter');
  await expect(page.getByText('Активность не сохранена', {exact:true})).toBeVisible();
  await expect(widget.getByPlaceholder('мин')).toHaveValue('25');
  expect(await page.evaluate(() => localStorage.getItem('activity.manual.v1'))).toBeNull();
});

test('manual activity validates duration and has accessible controls', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Тест виджета');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await expect(page.getByText('Тест виджета', {exact:true})).toBeVisible();
  await page.goto('/');
  const widget = page.locator('[data-widget="activity"]');
  await widget.getByRole('button', {name:'Добавить тренировку'}).click();
  await widget.getByRole('combobox', {name:'Вид активности'}).selectOption('walk');
  const duration = widget.getByRole('textbox', {name:'Длительность в минутах'});
  await duration.fill('1441');
  await widget.getByRole('button', {name:'Сохранить активность'}).click();
  await expect(widget.getByRole('alert')).toHaveText('Укажите целое число минут от 1 до 1440.');
  await expect(duration).toHaveAttribute('aria-invalid', 'true');
  await duration.fill('25');
  await widget.getByRole('button', {name:'Сохранить активность'}).click();
  const remove = widget.getByRole('button', {name:'Удалить: Ходьба, 25 мин'});
  await expect(remove).toBeVisible();
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(remove).toHaveCount(0);
});
