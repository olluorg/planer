import { test, expect } from '@playwright/test';

test('графики подгружаются по требованию и рисуются', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('onboarding.done.v1', '1'));
  const chartChunk: string[] = [];
  page.on('request', (r) => { if (/\/assets\/charts-.*\.js$/.test(r.url())) chartChunk.push(r.url()); });

  // Настройки — экран без графиков: тяжёлый чанк ECharts не должен грузиться.
  await page.goto('/settings');
  await page.waitForLoadState('networkidle');
  expect(chartChunk, 'ECharts загрузился на экране без графиков').toEqual([]);

  // Демо-данные дают графикам что рисовать.
  await page.getByRole('button', { name: /Загрузить примеры/ }).click();
  await page.goto('/analytics');
  // Именно холст ECharts: просто canvas может оказаться конфетти за награды,
  // которые начисляются при загрузке примеров.
  await expect(page.locator('[_echarts_instance_] canvas').first()).toBeVisible({ timeout: 15_000 });
  expect(chartChunk.length).toBeGreaterThan(0);
});
