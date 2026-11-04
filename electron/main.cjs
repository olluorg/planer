const { app, BrowserWindow, Menu, Notification, Tray, globalShortcut, ipcMain, session, shell, protocol, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { createReminderScheduler } = require('./reminder-scheduler.cjs');

const DEV_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIR = path.join(__dirname, '..', 'dist');
// В упакованном виде иконку ставит electron-builder; здесь — для dev/--dir запуска
const ICON = path.join(__dirname, '..', 'build', 'icon.png');

// Приложение живёт в трее, поэтому повторный запуск ярлыка не должен поднимать
// второй экземпляр — он показывает уже работающее окно.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => showWindow());
}

// Схема должна быть привилегированной до app.ready, иначе рендерер не получит
// secure-context (нужен для IndexedDB, WASM и service worker'ов).
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

/** Совместимость с предыдущими сборками без встроенных обоев: отсутствующие файлы
 *  можно получить с сайта и сохранить в кэш. Новые сборки включают обои локально. */
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
    let rel;
    try { rel = decodeURIComponent(pathname); }
    catch { return new Response('Bad request', { status: 400 }); }
    const target = path.join(RENDERER_DIR, rel);

    // Не выпускаем чтение за пределы dist/
    const relativeTarget = path.relative(RENDERER_DIR, target);
    if (relativeTarget === '..' || relativeTarget.startsWith(`..${path.sep}`) || path.isAbsolute(relativeTarget)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (isRemoteAsset(rel) && !fs.existsSync(target)) return serveRemoteAsset(rel);
    // SPA-фолбэк: путь без расширения — это маршрут, отдаём index.html.
    const hasExtension = path.extname(target) !== '';
    const file = hasExtension ? target : path.join(RENDERER_DIR, 'index.html');
    // Явный 404 вместо net::ERR_FILE_NOT_FOUND: иначе в логе только стек
    // загрузчика, без имени файла, и понять причину невозможно.
    if (!fs.existsSync(file)) {
      console.error(`[renderer] нет файла: ${rel}`);
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(file).toString());
  });
}

/* ===== Напоминания при закрытом окне =====
 * Ради этого десктопная версия и нужна: в браузере таймеры умирают вместе со
 * вкладкой. Рендерер присылает расписание, main держит таймеры и показывает
 * системные уведомления, пока приложение живёт в трее.
 */
const reminderScheduler = createReminderScheduler({
  notify: (r) => new Notification({ title: 'THEDAD', body: r.text }).on('click', showWindow).show(),
});

ipcMain.on('reminders:set', (_e, list) => {
  reminderScheduler.replace(Notification.isSupported() ? list : []);
});

/* ===== Окно и трей ===== */

let mainWindow = null;
let tray = null;
// Отличаем «закрыть окно» (уходим в трей) от «выйти» (реально завершаемся).
let quitting = false;
let hintShown = false;

function showWindow() {
  if (!mainWindow) { createWindow(); return; }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function createTray() {
  if (tray) return;
  try {
    tray = new Tray(ICON);
    tray.setToolTip('THEDAD');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Открыть THEDAD', click: showWindow },
      { type: 'separator' },
      { label: 'Выйти', click: () => { quitting = true; app.quit(); } },
    ]));
    tray.on('click', showWindow);
  } catch (e) {
    // Нет трея (некоторые окружения Linux) — не повод не запускаться.
    console.error('[tray]', e?.message ?? e);
  }
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
      // Явно, а не по умолчанию: preload нужен только contextBridge и ipcRenderer,
      // а песочница отрезает рендерер от Node даже при ошибке в preload.
      sandbox: true,
    },
  });

  mainWindow = win;
  win.once('ready-to-show', () => win.show());

  // Крестик прячет окно, а не завершает приложение: иначе напоминания
  // перестанут приходить ровно в тот момент, когда они нужны.
  win.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    win.hide();
    // Один раз объясняем, куда делось окно: иначе «закрыл, а процесс висит»
    // выглядит как баг.
    if (!hintShown) {
      hintShown = true;
      if (Notification.isSupported()) {
        new Notification({
          title: 'THEDAD свернулся в трей',
          body: 'Приложение продолжает напоминать о задачах. Выйти — правый клик по значку в трее.',
        }).on('click', showWindow).show();
      }
    }
  });
  win.on('closed', () => { mainWindow = null; });

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

  // Окно с мостом в main-процесс не должно уходить на чужой сайт: ссылка без
  // target=_blank или редирект увели бы его туда вместе с window.desktop.
  // Своё приложение — пропускаем, внешнее — в системный браузер.
  win.webContents.on('will-navigate', (e, url) => {
    if (isAppUrl(url)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) shell.openExternal(url);
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

/** Быстрая запись поверх любого приложения: задача за две секунды, не
 *  переключаясь в планер вручную. Клавиша может быть занята другой
 *  программой — тогда просто работаем без неё. */
const QUICK_CAPTURE_KEY = 'CommandOrControl+Shift+Space';
function registerQuickCapture() {
  const ok = globalShortcut.register(QUICK_CAPTURE_KEY, () => {
    showWindow();
    mainWindow?.webContents.send('quick-capture');
  });
  if (!ok) console.error(`[shortcut] ${QUICK_CAPTURE_KEY} занята другой программой`);
}
app.on('will-quit', () => globalShortcut.unregisterAll());

/** Адрес принадлежит самому приложению (упакованному или dev-серверу). */
function isAppUrl(url) {
  if (url.startsWith('app://planer/')) return true;
  return Boolean(DEV_URL) && url.startsWith(DEV_URL);
}

/** Из всех разрешений браузера приложению нужны три: уведомления, геолокация
 *  для погоды и запись в буфер обмена для «Скопировать отчёт». Камера,
 *  микрофон, MIDI и прочее — отказ без вопросов. */
const ALLOWED_PERMISSIONS = new Set(['notifications', 'geolocation', 'clipboard-sanitized-write']);

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => {
    cb(ALLOWED_PERMISSIONS.has(permission) && isAppUrl(wc.getURL()));
  });
  if (!DEV_URL) serveRenderer();
  createWindow();
  createTray();
  registerQuickCapture();
  setupAutoUpdate();
  app.on('activate', showWindow);
});

app.on('before-quit', () => { quitting = true; });

// Окно закрыто — приложение продолжает жить в трее ради напоминаний.
// Выход только через меню трея или before-quit.
app.on('window-all-closed', () => {});
