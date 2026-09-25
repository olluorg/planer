import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { appDefine } from './vite.shared';

export default defineConfig({
  base: './',
  // Без этого в бандл расширения уезжал сырой идентификатор __APP_VERSION__.
  define: appDefine,
  build: { outDir: 'dist' },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  optimizeDeps: { include: ['sql.js'] },
});
