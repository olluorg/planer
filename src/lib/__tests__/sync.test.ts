// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { freshEnv } from './dbHarness';

vi.mock('sql.js', async (orig) => (await import('./dbHarness')).sqlJsWithLocalWasm(orig));
vi.mock('sql.js/dist/sql-wasm.wasm?url', () => ({ default: '' }));

/** Поддельный sync-сервер в памяти: то же API, что server/index.js. Хранит
 *  ровно то, что пришло по сети, — по этому и проверяем, что он видит. */
function fakeServer() {
  const vaults = new Map<string, { token: string; ciphertext: string | null; updatedAt: number; revision: number; email?: string; salt?: string; pass?: string }>();
  let n = 0;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const handler = async (url: string, init: RequestInit = {}) => {
    const path = new URL(url).pathname;
    const body = init.body ? JSON.parse(String(init.body)) : {};
    const auth = String((init.headers as Record<string, string> | undefined)?.Authorization ?? '').replace('Bearer ', '');
    if (path === '/vault' && init.method === 'POST') {
      const id = `v${++n}`; vaults.set(id, { token: `t${n}`, ciphertext: null, updatedAt: 0, revision: 0 });
      return json(200, { syncId: id, authToken: `t${n}` });
    }
    if (path === '/register') {
      const id = `v${++n}`; vaults.set(id, { token: `t${n}`, ciphertext: null, updatedAt: 0, revision: 0, email: body.email, salt: body.salt, pass: body.password });
      return json(200, { syncId: id, authToken: `t${n}`, salt: body.salt });
    }
    if (path === '/login') {
      const hit = [...vaults].find(([, v]) => v.email === body.email && v.pass === body.password);
      return hit ? json(200, { syncId: hit[0], authToken: hit[1].token, salt: hit[1].salt }) : json(401, { error: 'неверный email или пароль' });
    }
    const m = path.match(/^\/vault\/(.+)$/);
    if (m) {
      const v = vaults.get(m[1]);
      if (!v || v.token !== auth) return json(401, { error: 'bad token' });
      if (init.method === 'PUT') {
        if (body.expectedRevision !== v.revision) return json(409, { error: 'vault changed' });
        v.ciphertext = body.ciphertext; v.updatedAt = body.updatedAt; v.revision++;
        return json(200, { ok: true, revision: v.revision });
      }
      return json(200, { ciphertext: v.ciphertext, updatedAt: v.updatedAt, revision: v.revision });
    }
    return json(404, {});
  };
  return { vaults, handler };
}

let env: Awaited<ReturnType<typeof freshEnv>>;
let server: ReturnType<typeof fakeServer>;
beforeEach(async () => {
  env = await freshEnv();
  server = fakeServer();
  vi.stubGlobal('fetch', vi.fn((u: string, i?: RequestInit) => server.handler(u, i)));
  history.replaceState(null, '', '/');
});

async function withGoal(title: string) {
  const db = await env.db();
  await db.getDB();
  db.exec('INSERT INTO goals (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [title, title, 'x', 'x']);
  await db.persist();
  return db;
}

describe('синхронизация', () => {
  it('использует доступный телефону адрес для QR из расширения и десктопа', async () => {
    const { syncLinkBase } = await import('../sync');
    expect(syncLinkBase('chrome-extension://example/index.html#/settings')).toBe('https://thedad.ru/');
    expect(syncLinkBase('app://planer/settings')).toBe('https://thedad.ru/');
    expect(syncLinkBase('https://planner.example/settings?x=1')).toBe('https://planner.example/settings');
  });

  it('предупреждает о недоступном телефону сервере и небезопасном протоколе', async () => {
    const { syncLinkWarning } = await import('../sync');
    expect(syncLinkWarning('http://localhost:8787', 'app://planer/')).toMatch(/сам телефон/);
    expect(syncLinkWarning('http://127.0.0.1:8787', 'https://thedad.ru/')).toMatch(/сам телефон/);
    expect(syncLinkWarning('http://192.168.1.2:8787', 'https://thedad.ru/')).toMatch(/HTTPS/);
    expect(syncLinkWarning('https://sync.example.com', 'app://planer/')).toBeNull();
  });
  it('сервер получает только шифр — ни названий, ни заголовка SQLite', async () => {
    await withGoal('Секретная цель');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    const blob = [...server.vaults.values()][0].ciphertext!;
    const bytes = Uint8Array.from(atob(blob), (c) => c.charCodeAt(0));
    const asText = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    expect(asText).not.toContain('Секретная цель');
    expect(asText).not.toContain('SQLite format 3');
    expect(asText.startsWith('TDD')).toBe(true); // формат cryptoExport
  });

  it('второе устройство по email и паролю получает те же данные', async () => {
    await withGoal('Общая цель');
    let sync = await import('../sync');
    await sync.registerEmail('https://sync.test', 'a@b.ru', 'password123');

    // «Второе устройство»: чистое хранилище, тот же сервер.
    const { clear } = await import('idb-keyval');
    await clear(); localStorage.clear(); vi.resetModules();
    sync = await import('../sync');
    await sync.loginEmail('https://sync.test', 'a@b.ru', 'password123');
    const db = await import('../db');
    await db.getDB();
    expect(db.query<{ title: string }>('SELECT title FROM goals').map((g) => g.title)).toEqual(['Общая цель']);
  });

  it('QR-ссылка переносит доступ и стирает секреты из адресной строки', async () => {
    await withGoal('Цель');
    let sync = await import('../sync');
    await sync.createVault('https://sync.test');
    const link = sync.buildSyncLink()!;
    expect(link).toContain('#sync=');

    const { clear } = await import('idb-keyval');
    await clear(); localStorage.clear(); vi.resetModules();
    history.replaceState(null, '', new URL(link).pathname + new URL(link).hash);
    sync = await import('../sync');
    expect(await sync.importSyncFromHashIfPresent()).toBe(true);
    expect(location.hash).toBe(''); // ключ шифрования не остаётся в истории браузера
    const db = await import('../db');
    await db.getDB();
    expect(db.query('SELECT * FROM goals')).toHaveLength(1);
  });

  it('испорченная ссылка ничего не ломает', async () => {
    history.replaceState(null, '', '/#sync=не-base64');
    const sync = await import('../sync');
    expect(await sync.importSyncFromHashIfPresent()).toBe(false);
    expect(sync.getSync()).toBeNull();
    expect(location.hash).toBe('');
  });

  it('при ошибке сети сохраняет предыдущее подключение и убирает секреты QR из адреса', async () => {
    await withGoal('Местная');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    const previous = sync.getSync()!;
    const payload = btoa(JSON.stringify({ s: 'https://other.test', i: 'other', t: 'secret', k: previous.encKey })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    history.replaceState(null, '', `/?keep=1#sync=${payload}`);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Нет сети')));
    await expect(sync.importSyncFromHashIfPresent()).rejects.toThrow('Нет сети');
    expect(sync.getSync()).toEqual(previous);
    expect(location.hash).toBe('');
    expect(location.search).toBe('?keep=1');
  });

  it('неверный пароль не трогает локальную базу', async () => {
    await withGoal('Местная');
    let sync = await import('../sync');
    await sync.registerEmail('https://sync.test', 'a@b.ru', 'password123');
    vi.resetModules();
    sync = await import('../sync');
    await expect(sync.loginEmail('https://sync.test', 'a@b.ru', 'wrong-pass')).rejects.toThrow(/неверный/);
    const db = await import('../db');
    await db.getDB();
    expect(db.query<{ title: string }>('SELECT title FROM goals')[0].title).toBe('Местная');
  });

  it('два устройства правят офлайн — после синка у обоих всё', async () => {
    // Ноутбук: цель, заводит хранилище.
    await withGoal('С ноутбука');
    let sync = await import('../sync');
    await sync.registerEmail('https://sync.test', 'a@b.ru', 'password123');

    // Телефон: входит, получает цель ноутбука, добавляет свою.
    const { clear } = await import('idb-keyval');
    await clear(); localStorage.clear(); vi.resetModules();
    sync = await import('../sync');
    await sync.loginEmail('https://sync.test', 'a@b.ru', 'password123');
    let db = await import('../db');
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('phone', 'С телефона', 'x', '2026-09-25T10:00:00.000Z')");
    const r = await sync.syncNow();
    expect(r).toEqual({ incoming: 0, deleted: 0 }); // сервер ничего нового не принёс

    // Раньше: синк «побеждает последний» затёр бы одну из целей.
    const titles = db.query<{ title: string }>('SELECT title FROM goals ORDER BY title').map((g) => g.title);
    expect(titles).toEqual(['С ноутбука', 'С телефона']);
    db = await import('../db');
  });

  it('два синка одновременно не сливают дважды', async () => {
    await withGoal('Цель');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    const [a, b] = [sync.syncNow(), sync.syncNow()];
    expect(a).toBe(b); // второй вызов получает тот же синк, а не запускает новый
    await a;
  });

  it('ручной синк запускает новый обмен после уже начатого фонового', async () => {
    await withGoal('Цель');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const entered = new Promise<void>(resolve => { started = resolve; });
    let first = true;
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => {
      if (first && (!i?.method || i.method === 'GET') && u.includes('/vault/')) {
        first = false;
        const response = await server.handler(u, i);
        started();
        await gate;
        return response;
      }
      return server.handler(u, i);
    }));
    const background = sync.syncNow();
    await entered;
    const manual = sync.syncNowFresh();
    release();
    await Promise.all([background, manual]);
    expect([...server.vaults.values()][0].revision).toBe(3);
  });

  it('после отключения не применяет и не отправляет данные старого подключения', async () => {
    await withGoal('Локальная цель');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    const vault = [...server.vaults.values()][0];
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => {
      const response = await server.handler(u, i);
      if ((!i?.method || i.method === 'GET') && u.includes('/vault/')) { entered(); await gate; }
      return response;
    }));
    const pending = sync.syncNow();
    await started;
    sync.disconnectSync();
    release();
    await expect(pending).rejects.toThrow(/Подключение изменилось/);
    expect(vault.revision).toBe(1);
    expect(sync.getSync()).toBeNull();
  });

  it('не возобновляет старый обмен после повторного входа в то же хранилище', async () => {
    await withGoal('Цель');
    const sync = await import('../sync');
    await sync.registerEmail('https://sync.test', 'same@example.com', 'password123');
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    let held = false;
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => {
      const response = await server.handler(u, i);
      if (!held && (!i?.method || i.method === 'GET') && u.includes('/vault/')) { held = true; entered(); await gate; }
      return response;
    }));
    const oldSync = sync.syncNow();
    const oldResult = expect(oldSync).rejects.toThrow(/Подключение изменилось/);
    await started;
    sync.disconnectSync();
    const login = sync.loginEmail('https://sync.test', 'same@example.com', 'password123');
    await vi.waitFor(() => expect(sync.getSync()?.email).toBe('same@example.com'));
    release();
    await oldResult;
    await expect(login).resolves.toBeUndefined();
    expect([...server.vaults.values()][0].revision).toBe(2);
  });

  it('отменяет старый обмен при переподключении в другой вкладке', async () => {
    await withGoal('Цель');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    const original = localStorage.getItem('thedad.sync.v1')!;
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => {
      const response = await server.handler(u, i);
      if ((!i?.method || i.method === 'GET') && u.includes('/vault/')) { entered(); await gate; }
      return response;
    }));
    const pending = sync.syncNow();
    await started;
    window.dispatchEvent(new StorageEvent('storage', { key: 'thedad.sync.v1', oldValue: original, newValue: null }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'thedad.sync.v1', oldValue: null, newValue: original }));
    release();
    await expect(pending).rejects.toThrow(/Подключение изменилось/);
    expect([...server.vaults.values()][0].revision).toBe(1);
  });

  it('не заменяет базу и не возвращает подключение при отключении во время загрузки копии', async () => {
    const db = await withGoal('Исходная');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('new', 'Поздняя', 'x', 'x')");
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    const started = new Promise<void>(resolve => { entered = resolve; });
    vi.stubGlobal('fetch', vi.fn(async (u: string, i?: RequestInit) => {
      const response = await server.handler(u, i);
      if ((!i?.method || i.method === 'GET') && u.includes('/vault/')) { entered(); await gate; }
      return response;
    }));
    const pending = sync.pullNow();
    await started;
    sync.disconnectSync();
    release();
    await expect(pending).rejects.toThrow(/Подключение изменилось/);
    expect(db.query<{ title: string }>('SELECT title FROM goals ORDER BY title').map(row => row.title)).toEqual(['Исходная', 'Поздняя']);
    expect(sync.getSync()).toBeNull();
  });

  it('повторяет синхронизацию после конфликта версии', async () => {
    await withGoal('Цель');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    let conflict = true;
    vi.stubGlobal('fetch', vi.fn((u: string, i?: RequestInit) => {
      if (i?.method === 'PUT' && conflict) {
        conflict = false;
        return Promise.resolve(new Response(JSON.stringify({ error: 'vault changed' }), { status: 409 }));
      }
      return server.handler(u, i);
    }));
    await expect(sync.syncNow()).resolves.toEqual({ incoming: 0, deleted: 0 });
    expect(conflict).toBe(false);
    expect([...server.vaults.values()][0].revision).toBe(2);
  });

  it('не записывает данные на старый сервер без проверки версии', async () => {
    await withGoal('Цель');
    const sync = await import('../sync');
    await sync.createVault('https://sync.test');
    const vault = [...server.vaults.values()][0];
    const previous = vault.ciphertext;
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(JSON.stringify({ ciphertext: previous }), { status: 200 }))));
    await expect(sync.syncNow()).rejects.toThrow(/Обновите сервер/);
    expect(vault.ciphertext).toBe(previous);
  });

  it('после входа на новом устройстве первая же правка не затирает скачанное', async () => {
    // Регрессия: loginEmail клал скачанную базу только в IndexedDB, открытая в
    // памяти оставалась пустой, и первая правка записывала пустоту поверх.
    await withGoal('Из облака');
    let sync = await import('../sync');
    await sync.registerEmail('https://sync.test', 'a@b.ru', 'password123');

    const { clear } = await import('idb-keyval');
    await clear(); localStorage.clear(); vi.resetModules();
    const db = await import('../db');
    await db.getDB(); // новое устройство уже открыло свою пустую базу
    sync = await import('../sync');
    await sync.loginEmail('https://sync.test', 'a@b.ru', 'password123');

    // Без перезагрузки: пользователь сразу что-то делает.
    db.exec("INSERT INTO goals (id, title, created_at, updated_at) VALUES ('n', 'Новая', 'x', 'x')");
    await db.persist();
    const titles = db.query<{ title: string }>('SELECT title FROM goals ORDER BY title').map((g) => g.title);
    expect(titles).toEqual(['Из облака', 'Новая']);
    // Вход теперь сливает, а не заменяет: то, что было на устройстве до входа,
    // не затирается, поэтому и снимок «на всякий случай» не нужен.
  });

  it('файл, не являющийся базой, отвергается без порчи текущей', async () => {
    const db = await withGoal('Живая');
    await expect(db.replaceDatabase(new TextEncoder().encode('это не база'), 'x')).rejects.toThrow(/не файл базы/);
    expect(db.query('SELECT * FROM goals')).toHaveLength(1);
  });
});
