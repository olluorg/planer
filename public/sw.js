// Minimal app-shell service worker. Caches the navigation shell and same-origin static assets
// so the app boots offline. Dynamic data lives in IndexedDB and is independent of the cache.

// Версию подставляет сборка (см. плагин sw-version в vite.config.ts). В dev
// остаётся плейсхолдер — там service worker не регистрируется.
const CACHE = 'thedad-shell-__SW_VERSION__';
// Только то, что реально существует по этим путям в проде. Манифест сюда не
// входит: Vite отдаёт его по хешированному имени, и addAll() на 404 отклоняет
// ВЕСЬ precache — приложение молча остаётся без офлайн-оболочки.
const SHELL = ['/', '/index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  // Без skipWaiting: новый воркер ждёт, пока пользователь сам согласится
  // обновиться — иначе ассеты подменяются под открытым приложением.
});

// Кнопка «обновить» в интерфейсе просит ожидающий воркер активироваться.
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
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
    caches.match(req).then((cached) => {
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
