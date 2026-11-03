import {test, expect} from '@playwright/test';

test('profile edits survive reload and update the menu', async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem('onboarding.done.v1', '1'); if (!localStorage.getItem('theme')) localStorage.setItem('theme','work');});
  await page.goto('/');
  await page.getByRole('button',{name:'Меню профиля'}).click();
  await page.getByRole('button',{name:'Профиль',exact:true}).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText('Целей пока нет.')).toBeVisible();
  await page.getByLabel('Имя', {exact:true}).fill('Анна');
  await page.getByLabel(/Занятие или роль/).fill('Дизайнер');
  await page.getByRole('button',{name:'Сохранить профиль'}).click();
  await expect(page.getByRole('button',{name:'Меню профиля'})).toHaveAttribute('title','Анна');
  await page.reload();
  await expect(page.getByLabel('Имя',{exact:true})).toHaveValue('Анна');
  await expect(page.getByLabel(/Занятие или роль/)).toHaveValue('Дизайнер');
  await page.getByLabel('Имя',{exact:true}).fill('');
  await page.getByRole('button',{name:'Сохранить профиль'}).click();
  await expect(page.getByRole('alert')).toContainText('Укажите имя');
});

test('profile counts reflect tasks and goals rather than example values', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1','1'));
  await page.goto('/tasks');
  await page.getByPlaceholder('Новая задача...').fill('Первая задача');
  await page.getByPlaceholder('Новая задача...').press('Enter');
  await page.getByRole('checkbox',{name:'Первая задача'}).click();
  await page.goto('/profile');
  await expect(page.getByText('Выполнено задач').locator('..')).toContainText('1');
  await expect(page.getByText('Активных целей').locator('..')).toContainText('0');
});

test('profile photo can be replaced and removed', async ({page}) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1','1'));
  await page.goto('/profile');
  await page.locator('input[type="file"]').setInputFiles({name:'avatar.png', mimeType:'image/png', buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/ZV0AAAAASUVORK5CYII=', 'base64')});
  await expect(page.getByRole('img',{name:'Фото профиля'})).toBeVisible();
  await page.reload();
  await expect(page.getByRole('img',{name:'Фото профиля'})).toBeVisible();
  await page.getByRole('button',{name:'Удалить фото профиля'}).click();
  await expect(page.getByRole('img',{name:'Фото профиля'})).toHaveCount(0);
});

test('workspace profile fields and controls remain legible at narrow widths', async ({page}) => {
  await page.addInitScript(() => {localStorage.setItem('onboarding.done.v1','1'); localStorage.setItem('theme','work');});
  await page.setViewportSize({width:320,height:800});
  await page.goto('/profile');
  const button=page.getByRole('button',{name:'Все цели'});
  const box=(await button.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x+box.width).toBeLessThanOrEqual(320);
  expect(await button.evaluate(el => getComputedStyle(el).whiteSpace)).toBe('nowrap');
  const ratio=await page.getByLabel('Имя',{exact:true}).evaluate(el=>{
    const linear=(n:number)=>{const c=n/255;return c<=.04045?c/12.92:((c+.055)/1.055)**2.4;};
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d')!;
    const lum=(color:string)=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);const x=ctx.getImageData(0,0,1,1).data;return .2126*linear(x[0])+.7152*linear(x[1])+.0722*linear(x[2]);};
    const style=getComputedStyle(el), a=lum(style.borderColor), b=lum(style.backgroundColor);
    return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(3);
});
