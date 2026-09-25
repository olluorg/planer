import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { appDefine, cspMeta, swVersion, spaFallback } from './vite.shared';

const outDir = path.resolve(__dirname, 'dist');

export default defineConfig({
  base: '/',
  // Версия из package.json доступна в коде — нужна в отчётах об ошибках и в About.
  define: appDefine,
  plugins: [react(), cspMeta(), swVersion(outDir), spaFallback(outDir)],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  optimizeDeps: { include: ['sql.js'] },
  server: { port: 5173 },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined;
          // Пакеты, которые грузятся только динамическим import(): отдаём решение
          // Rollup'у. Иначе правило ниже загоняет их в стартовый vendor и
          // ленивая загрузка молча перестаёт быть ленивой.
          if (id.includes('@noble/') || id.includes('/qrcode/')) return undefined;
          if (id.includes('echarts') || id.includes('zrender')) return 'charts';
          if (id.includes('react-grid-layout') || id.includes('react-resizable') || id.includes('react-draggable')) return 'grid';
          if (id.includes('sql.js')) return 'sqlite';
          if (id.includes('@dnd-kit')) return 'dnd';
          if (id.includes('@radix-ui')) return 'radix';
          if (id.includes('cmdk')) return 'cmdk';
          if (id.includes('date-fns')) return 'date';
          if (id.includes('lucide-react')) return 'icons';
          return 'vendor';
        },
      },
    },
  },
});
