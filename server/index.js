// THEDAD sync-сервер: хранит ТОЛЬКО зашифрованные на клиенте блобы БД (E2E).
// Сервер не видит содержимое и не знает ключ шифрования. Два способа входа:
//  - аноним/QR: создаём vault, клиент держит authToken+encKey (encKey в QR, не на сервере);
//  - email+пароль: сервер хранит хеш пароля и salt; encKey клиент выводит из пароля (PBKDF2).
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import pg from 'pg';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://thedad:thedad@localhost:5432/thedad' });
// Без обработчика обрыв простаивающего соединения (перезапуск Postgres,
// обновление образа) — это необработанное событие 'error', и процесс падает
// целиком. Пул сам заменит соединение; запросы в это время получат ошибку,
// а /health честно ответит 503.
pool.on('error', (err) => console.error('[pg] соединение оборвалось:', err.message));

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS vaults (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE,
      pass_hash TEXT,
      salt TEXT,
      auth_token TEXT NOT NULL,
      ciphertext TEXT,
      updated_at BIGINT DEFAULT 0
    );
  `);
  // Каждый запрос к vault ищет строку по auth_token — без индекса это
  // последовательный скан по всей таблице.
  await pool.query('CREATE INDEX IF NOT EXISTS idx_vaults_auth_token ON vaults (auth_token)');
}

const token = () => randomBytes(32).toString('base64url');
const hashPw = (pw, salt) => scryptSync(pw, salt, 64).toString('hex');
/** Регистр и пробелы не должны плодить разные аккаунты на один адрес. */
const normEmail = (e) => (typeof e === 'string' && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim()) ? e.trim().toLowerCase() : null);
const safeEq = (a, b) => { const ab = Buffer.from(a), bb = Buffer.from(b); return ab.length === bb.length && timingSafeEqual(ab, bb); };

const app = Fastify({ bodyLimit: 60 * 1024 * 1024, trustProxy: true }); // до 60МБ на блоб БД

// CORS: список доменов через запятую в ALLOWED_ORIGINS. Пусто — разрешаем всё,
// это режим локальной разработки; в проде список задавать обязательно, иначе
// чужая страница сможет дёргать API от имени залогиненного пользователя.
const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
await app.register(cors, { origin: allowed.length ? allowed : true });

// Ограничение частоты. Общий потолок на IP плюс жёсткие лимиты на точки входа
// ниже: без них /login открыт для перебора паролей, а /vault позволяет одним
// скриптом создать сколько угодно пустых хранилищ.
await app.register(rateLimit, {
  global: true,
  max: Number(process.env.RATE_LIMIT_MAX) || 120,
  timeWindow: '1 minute',
});

/** Лимит для конкретного маршрута. */
const limit = (max, timeWindow) => ({ config: { rateLimit: { max, timeWindow } } });

// bearer authToken → vault
async function auth(req, reply) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t) { reply.code(401).send({ error: 'no token' }); return null; }
  const { rows } = await pool.query('SELECT * FROM vaults WHERE auth_token = $1', [t]);
  if (!rows[0]) { reply.code(401).send({ error: 'bad token' }); return null; }
  return rows[0];
}

// Проверяет и базу: без этого /health отвечал «ок», даже когда Postgres лежал,
// и внешний мониторинг не видел, что синк на самом деле не работает.
app.get('/health', { config: { rateLimit: false } }, async (_req, reply) => {
  try {
    await pool.query('SELECT 1');
    return { ok: true };
  } catch {
    return reply.code(503).send({ ok: false, error: 'db unavailable' });
  }
});

// Аноним (для QR-привязки): создаёт пустой vault
app.post('/vault', limit(5, '1 hour'), async () => {
  const id = randomUUID();
  const authToken = token();
  await pool.query('INSERT INTO vaults (id, auth_token) VALUES ($1, $2)', [id, authToken]);
  return { syncId: id, authToken };
});

// Регистрация по email+паролю. salt приходит с клиента (для вывода encKey), сервер его лишь хранит.
app.post('/register', limit(5, '1 hour'), async (req, reply) => {
  const { password, salt } = req.body || {};
  const email = normEmail(req.body?.email);
  if (!email || !password || !salt) return reply.code(400).send({ error: 'email, password, salt required' });
  if (String(password).length < 8) return reply.code(400).send({ error: 'пароль короче 8 символов' });
  const exists = await pool.query('SELECT 1 FROM vaults WHERE LOWER(email) = $1', [email]);
  if (exists.rows[0]) return reply.code(409).send({ error: 'email занят' });
  const id = randomUUID();
  const authToken = token();
  await pool.query('INSERT INTO vaults (id, email, pass_hash, salt, auth_token) VALUES ($1,$2,$3,$4,$5)',
    [id, email, hashPw(password, salt), salt, authToken]);
  return { syncId: id, authToken, salt };
});

app.post('/login', limit(10, '15 minutes'), async (req, reply) => {
  const { password } = req.body || {};
  const email = normEmail(req.body?.email);
  if (!email || !password) return reply.code(400).send({ error: 'email, password required' });
  const { rows } = await pool.query('SELECT * FROM vaults WHERE LOWER(email) = $1', [email]);
  const v = rows[0];
  if (!v || !v.pass_hash || !safeEq(v.pass_hash, hashPw(password, v.salt))) return reply.code(401).send({ error: 'неверный email или пароль' });
  return { syncId: v.id, authToken: v.auth_token, salt: v.salt };
});

// Выгрузка зашифрованного блоба
app.put('/vault/:id', async (req, reply) => {
  const v = await auth(req, reply); if (!v) return;
  if (v.id !== req.params.id) return reply.code(403).send({ error: 'forbidden' });
  const { ciphertext, updatedAt } = req.body || {};
  if (typeof ciphertext !== 'string') return reply.code(400).send({ error: 'ciphertext required' });
  await pool.query('UPDATE vaults SET ciphertext = $1, updated_at = $2 WHERE id = $3',
    [ciphertext, Number(updatedAt) || Date.now(), v.id]);
  return { ok: true, updatedAt: Number(updatedAt) || Date.now() };
});

// Скачивание последнего блоба
app.get('/vault/:id', async (req, reply) => {
  const v = await auth(req, reply); if (!v) return;
  if (v.id !== req.params.id) return reply.code(403).send({ error: 'forbidden' });
  return { ciphertext: v.ciphertext || null, updatedAt: Number(v.updated_at) || 0 };
});

const port = Number(process.env.PORT) || 8787;
// База может подниматься дольше сервера (перезагрузка машины, восстановление
// из дампа) — ждём её, а не падаем в цикл перезапусков.
for (let attempt = 1; ; attempt++) {
  try {
    await initDb();
    break;
  } catch (e) {
    if (attempt >= 30) throw e;
    console.error(`[pg] база недоступна (${e.message}), попытка ${attempt}/30`);
    await new Promise((r) => setTimeout(r, 2000));
  }
}
await app.listen({ host: '0.0.0.0', port });
console.log(`THEDAD sync-сервер на :${port}`);

// docker stop шлёт SIGTERM. Без обработчика процесс убивается через 10 секунд
// посреди запроса — а PUT /vault как раз пишет блоб пользователя.
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    try {
      await app.close(); // дожидается текущих запросов
      await pool.end();
    } finally {
      process.exit(0);
    }
  });
}
