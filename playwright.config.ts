import { defineConfig, devices } from '@playwright/test';

/** Сквозные тесты гоняются по ПРОДАКШЕН-сборке (dist), а не по dev-серверу:
 *  только в ней есть CSP, service worker и настоящие чанки — именно то, что
 *  ломается незаметно для dev-режима. Перед запуском нужен `bun run build`
 *  (скрипт test:e2e делает это сам). */
export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4174',
    trace: 'retain-on-failure',
  },
  projects: [
    // 1100px — уже брейкпоинта xl: на этой ширине страница «Цели» когда-то
    // схлопывалась в ноль, и dev-проверки на широком мониторе этого не видели.
    { name: 'laptop', use: { ...devices['Desktop Chrome'], viewport: { width: 1100, height: 800 } } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4174 --strictPort',
    url: 'http://localhost:4174',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
