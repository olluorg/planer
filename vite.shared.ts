/** Общее для обеих сборок Vite — веба (vite.config.ts) и расширения (vite.config.ext.ts).
 *  Раньше define жил только в веб-конфиге, и в расширение уезжал сырой идентификатор
 *  __APP_VERSION__: кнопка «Скопировать отчёт» падала с ReferenceError. */
import path from 'node:path';
import fs from 'node:fs';
import type { Plugin } from 'vite';
import pkg from './package.json' with { type: 'json' };

export const appVersion = pkg.version;

/** Константы, подставляемые в код на этапе сборки. */
export const appDefine = { __APP_VERSION__: JSON.stringify(appVersion) };

/** Content-Security-Policy для веба и десктопа.
 *
 *  Главное здесь — script-src: без него любая XSS исполняет чужой код с полным
 *  доступом к базе пользователя. Остальные директивы описывают реальные нужды:
 *  - 'wasm-unsafe-eval' — sql.js компилирует WebAssembly;
 *  - accounts.google.com — скрипт и окно Google Identity для копии в Диск;
 *  - youtube-nocookie.com — живые обои, мини-плеер, видео в рецептах;
 *  - connect-src широкий намеренно: адрес AI-провайдера пользователь вводит сам
 *    (в том числе Ollama по http в локальной сети в self-host-варианте), так что
 *    перечислить хосты заранее невозможно;
 *  - style-src 'unsafe-inline' — Radix и dnd-kit пишут стили атрибутом.
 *
 *  Ставится мета-тегом, а не заголовком: GitHub Pages заголовки задавать не даёт,
 *  а мета одинаково работает в браузере и в Electron. У расширения своя CSP в
 *  манифесте, строже этой. */
export const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval' https://accounts.google.com",
  "style-src 'self' 'unsafe-inline' https://accounts.google.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "connect-src 'self' https: http:",
  "frame-src https://www.youtube-nocookie.com https://accounts.google.com",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** Встраивает CSP в index.html. Только в сборке: dev-сервер Vite вставляет
 *  инлайн-скрипт react-refresh, и строгая политика сломала бы горячую перезагрузку. */
export function cspMeta(): Plugin {
  return {
    name: 'csp-meta',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler: () => [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' },
      ],
    },
  };
}

/** Подставляет версию сборки в кэш service worker'а: без этого имя кэша
 *  захардкожено и старые ассеты живут вечно. */
export function swVersion(outDir: string): Plugin {
  return {
    name: 'sw-version',
    apply: 'build',
    closeBundle() {
      const out = path.join(outDir, 'sw.js');
      if (!fs.existsSync(out)) return;
      const src = fs.readFileSync(out, 'utf-8');
      fs.writeFileSync(out, src.replace(/__SW_VERSION__/g, `${appVersion}-${Date.now().toString(36)}`));
    },
  };
}

/** GitHub Pages не знает про клиентский роутинг: прямой заход или обновление
 *  страницы на thedad.ru/goals отдавали его собственную 404. Pages показывает
 *  404.html на любой неизвестный путь — кладём туда само приложение, и роутер
 *  разбирает адрес как обычно. На nginx/Caddy файл просто не используется. */
export function spaFallback(outDir: string): Plugin {
  return {
    name: 'spa-fallback-404',
    apply: 'build',
    closeBundle() {
      const index = path.join(outDir, 'index.html');
      if (fs.existsSync(index)) fs.copyFileSync(index, path.join(outDir, '404.html'));
    },
  };
}
