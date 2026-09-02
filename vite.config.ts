import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import pkg from './package.json' with { type: 'json' };

/** Подставляет версию сборки в кэш service worker'а: без этого имя кэша
 *  захардкожено и старые ассеты живут вечно. */
function swVersion(version: string) {
  return {
    name: 'sw-version',
    closeBundle() {
      const out = path.resolve(__dirname, 'dist/sw.js');
      if (!fs.existsSync(out)) return;
      const src = fs.readFileSync(out, 'utf-8');
      fs.writeFileSync(out, src.replace(/__SW_VERSION__/g, `${version}-${Date.now().toString(36)}`));
    },
  };
}

export default defineConfig({
  base: '/',
  // Версия из package.json доступна в коде — нужна в отчётах об ошибках и в About.
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  plugins: [react(), swVersion(pkg.version)],
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
