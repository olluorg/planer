import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { existsSync } from 'node:fs';

test('desktop window can be hidden to tray and restored', async () => {
  test.skip(process.platform !== 'win32', 'Windows tray integration test');
  const profile = await mkdtemp(path.join(tmpdir(), 'thedad-desktop-test-'));
  const app = await electron.launch({ args: ['.', `--user-data-dir=${profile}`], cwd: process.cwd() });
  try {
    const window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await expect(window.locator('body')).toBeVisible();
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close());
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())).toBe(false);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].show());
    expect(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.isVisible())).toBe(true);
  } finally {
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await app.close().catch(() => {});
    await rm(profile, { recursive: true, force: true });
  }
});

test('packaged Windows app keeps a task after restart', async () => {
  const executablePath = path.resolve('release/win-unpacked/THEDAD.exe');
  test.skip(process.platform !== 'win32' || !existsSync(executablePath), 'Requires a local packaged Windows build');
  const profile = await mkdtemp(path.join(tmpdir(), 'thedad-packaged-test-'));
  let app: Awaited<ReturnType<typeof electron.launch>> | undefined;
  const launch = () => electron.launch({ executablePath, args: [`--user-data-dir=${profile}`] });
  const quit = async () => {
    if (!app) return;
    await app.evaluate(({ app: electronApp }) => electronApp.quit());
    await app.close().catch(() => {});
    app = undefined;
  };
  try {
    app = await launch();
    let window = await app.firstWindow();
    await window.waitForLoadState('domcontentloaded');
    await window.evaluate(() => localStorage.setItem('onboarding.done.v1', '1'));
    await window.goto('app://planer/tasks');
    const input = window.getByPlaceholder('Новая задача...');
    await input.fill('Проверка сохранения в Windows');
    await input.press('Enter');
    await expect(window.getByText('Проверка сохранения в Windows', { exact: true })).toBeVisible();
    await window.reload();
    await expect(window.getByText('Проверка сохранения в Windows', { exact: true })).toBeVisible();
    await window.getByPlaceholder('Новая задача...').fill('Задача перед выходом');
    await window.getByPlaceholder('Новая задача...').press('Enter');
    await quit();
    app = await launch();
    window = await app.firstWindow();
    await window.goto('app://planer/tasks');
    await expect(window.getByText('Проверка сохранения в Windows', { exact: true })).toBeVisible();
    await expect(window.getByText('Задача перед выходом', { exact: true })).toBeVisible();
  } finally {
    await quit();
    await rm(profile, { recursive: true, force: true });
  }
});
