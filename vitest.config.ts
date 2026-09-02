import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  test: {
    // Чистая логика — окружение браузера не нужно; Web Crypto есть в node >= 20.
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
