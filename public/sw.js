// Minimal app-shell service worker. Caches the navigation shell and same-origin static assets
// so the app boots offline. Dynamic data lives in IndexedDB and is independent of the cache.

// Версию подставляет сборка (см. плагин sw-version в vite.config.ts). В dev
// остаётся плейсхолдер — там service worker не регистрируется.
const CACHE = 'thedad-shell-__SW_VERSION__';
// Только то, что реально существует по этим путям в проде. Манифест сюда не
// входит: Vite отдаёт его по хешированному имени, и addAll() на 404 отклоняет
// ВЕСЬ precache — приложение молча остаётся без офлайн-оболочки.
// Build injects all code/font/WASM chunks, including lazy routes. Media is on demand.
const ASSETS = /*__PRECACHE_ASSETS__*/ [];
const SHELL = ['/', '/index.html', '/theme-init.js', ...ASSETS];

self.addEventListener('install', (e) => {
  // A partial download must not replace a working offline version.
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
  // Без skipWaiting: новый воркер ждёт, пока пользователь сам согласится
  // обновиться — иначе ассеты подменяются под открытым приложением.
});

// Кнопка «обновить» в интерфейсе просит ожидающий воркер активироваться.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith('thedad-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // SPA navigation: network-first, fallback to cached index.html.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then((r) => r || Response.error()))
    );
    return;
  }

  // Stale-while-revalidate for assets.
  e.respondWith(
    // Same-origin build assets are identical across Origin headers. Module loads
    // send Origin while install-time addAll does not; Vary: Origin must not hide
    // the precached response when the browser goes offline.
    caches.open(CACHE).then((cache) => cache.match(req, { ignoreVary: true })).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }).catch(() => cached || Response.error());
      return cached || fetchPromise;
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((cs) => {
    for (const c of cs) if ('focus' in c) return c.focus();
    if (self.clients.openWindow) return self.clients.openWindow('/');
  }));
});
