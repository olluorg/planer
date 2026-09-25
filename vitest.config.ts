import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(import.meta.dirname, './src') } },
  test: {
    // Чистая логика — окружение браузера не нужно; Web Crypto есть в node >= 20.
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Москва (UTC+3), а не UTC сервера CI: три бага с датами в этом проекте
    // жили только восточнее Гринвича, и в UTC тесты их бы не увидели.
    env: { TZ: 'Europe/Moscow' },
  },
});
