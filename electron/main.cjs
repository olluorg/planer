const { app, BrowserWindow, shell, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIR = path.join(__dirname, '..', 'dist');
// В упакованном виде иконку ставит electron-builder; здесь — для dev/--dir запуска
const ICON = path.join(__dirname, '..', 'build', 'icon.png');

// Схема должна быть привилегированной до app.ready, иначе рендерер не получит
// secure-context (нужен для IndexedDB, WASM и service worker'ов).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

/** Тяжёлый декоративный контент (обои — 29 МБ) в установщик не кладём: он и так
 *  весит больше сотни мегабайт из-за рантайма Electron. Такие файлы берём с сайта
 *  по требованию и кэшируем на диск, чтобы во второй раз работало офлайн. */
const REMOTE_ASSET_BASE = 'https://thedad.ru';
const REMOTE_ASSET_PREFIXES = ['/wallpapers/'];
const ASSET_CACHE_DIR = path.join(app.getPath('userData'), 'remote-assets');

const isRemoteAsset = (rel) => REMOTE_ASSET_PREFIXES.some((p) => rel.startsWith(p));

async function serveRemoteAsset(rel) {
  const cached = path.join(ASSET_CACHE_DIR, rel.replace(/^\//, '').replace(/[\\/]+/g, '_'));
  if (fs.existsSync(cached)) return net.fetch(pathToFileURL(cached).toString());
  try {
    const res = await net.fetch(REMOTE_ASSET_BASE + rel);
    if (!res.ok) return res;
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.promises.mkdir(ASSET_CACHE_DIR, { recursive: true });
    await fs.promises.writeFile(cached, buf);
    return new Response(buf, { headers: { 'content-type': res.headers.get('content-type') ?? 'application/octet-stream' } });
  } catch {
    // Нет сети и нет кэша — отдаём 404, интерфейс просто останется без картинки.
    return new Response('Not found', { status: 404 });
  }
}

/** Отдаёт файлы из dist/ так, чтобы абсолютные пути (/assets, /food) резолвились от корня бандла. */
function serveRenderer() {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url);
    const rel = decodeURIComponent(pathname);
    const target = path.join(RENDERER_DIR, rel);

    // Не выпускаем чтение за пределы dist/
    if (!target.startsWith(RENDERER_DIR)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (isRemoteAsset(rel) && !fs.existsSync(target)) return serveRemoteAsset(rel);
    // SPA-фолбэк: любой неизвестный путь отдаём как index.html, роутер разберётся
    const hasExtension = path.extname(target) !== '';
    const file = hasExtension ? target : path.join(RENDERER_DIR, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0f1117',
    icon: ICON,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[renderer] load failed ${code} ${desc} — ${url}`);
  });
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) console.error(`[renderer] ${message}`);
  });

  // Внешние ссылки — в системный браузер, а не внутрь окна приложения
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (DEV_URL) {
    win.loadURL(DEV_URL);
  } else {
    win.loadURL('app://planer/');
  }
}

/** Автообновление с GitHub Releases (electron-updater читает latest.yml из релиза).
 *  Работает только в установленной (NSIS) версии; portable обновляется вручную.
 *  Ошибки глотаем: нет сети / нет опубликованного релиза — не повод падать. */
function setupAutoUpdate() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require('electron-updater');
    autoUpdater.autoDownload = true;
    autoUpdater.on('error', (e) => console.error('[updater]', e?.message ?? e));
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    // Периодическая проверка раз в 4 часа — приложение часто живёт неделями
    setInterval(() => autoUpdater.checkForUpdatesAndNotify().catch(() => {}), 4 * 60 * 60 * 1000);
  } catch (e) {
    console.error('[updater] init failed:', e?.message ?? e);
  }
}

app.whenReady().then(() => {
  if (!DEV_URL) serveRenderer();
  createWindow();
  setupAutoUpdate();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
