// THEDAD sync-сервер: хранит ТОЛЬКО зашифрованные на клиенте блобы БД (E2E).
// Сервер не видит содержимое и не знает ключ шифрования. Два способа входа:
//  - аноним/QR: создаём vault, клиент держит authToken+encKey (encKey в QR, не на сервере);
//  - email+пароль: сервер хранит хеш пароля и salt; encKey клиент выводит из пароля (PBKDF2).
import Fastify from 'fastify';
import cors from '@fastify/cors';
import pg from 'pg';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://thedad:thedad@localhost:5432/thedad' });

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
}

const token = () => randomBytes(32).toString('base64url');
const hashPw = (pw, salt) => scryptSync(pw, salt, 64).toString('hex');
const safeEq = (a, b) => { const ab = Buffer.from(a), bb = Buffer.from(b); return ab.length === bb.length && timingSafeEqual(ab, bb); };

const app = Fastify({ bodyLimit: 60 * 1024 * 1024 }); // до 60МБ на блоб БД
await app.register(cors, { origin: true });

// bearer authToken → vault
async function auth(req, reply) {
  const h = req.headers.authorization || '';
  const t = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!t) { reply.code(401).send({ error: 'no token' }); return null; }
  const { rows } = await pool.query('SELECT * FROM vaults WHERE auth_token = $1', [t]);
  if (!rows[0]) { reply.code(401).send({ error: 'bad token' }); return null; }
  return rows[0];
}

app.get('/health', async () => ({ ok: true }));

// Аноним (для QR-привязки): создаёт пустой vault
app.post('/vault', async () => {
  const id = randomUUID();
  const authToken = token();
  await pool.query('INSERT INTO vaults (id, auth_token) VALUES ($1, $2)', [id, authToken]);
  return { syncId: id, authToken };
});

// Регистрация по email+паролю. salt приходит с клиента (для вывода encKey), сервер его лишь хранит.
app.post('/register', async (req, reply) => {
  const { email, password, salt } = req.body || {};
  if (!email || !password || !salt) return reply.code(400).send({ error: 'email, password, salt required' });
  const exists = await pool.query('SELECT 1 FROM vaults WHERE email = $1', [email]);
  if (exists.rows[0]) return reply.code(409).send({ error: 'email занят' });
  const id = randomUUID();
  const authToken = token();
  await pool.query('INSERT INTO vaults (id, email, pass_hash, salt, auth_token) VALUES ($1,$2,$3,$4,$5)',
    [id, email, hashPw(password, salt), salt, authToken]);
  return { syncId: id, authToken, salt };
});

app.post('/login', async (req, reply) => {
  const { email, password } = req.body || {};
  if (!email || !password) return reply.code(400).send({ error: 'email, password required' });
  const { rows } = await pool.query('SELECT * FROM vaults WHERE email = $1', [email]);
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
await initDb();
await app.listen({ host: '0.0.0.0', port });
console.log(`THEDAD sync-сервер на :${port}`);
