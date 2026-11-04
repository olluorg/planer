import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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
