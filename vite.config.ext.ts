import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  plugins: [react()],
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  optimizeDeps: { include: ['sql.js'] },
});
