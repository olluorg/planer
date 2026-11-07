const { randomBytes } = require('node:crypto');

// This storage is not yet connected to public routes. State is server-only and
// short-lived; the finishing route must still verify OPAQUE and the vault status.
const MAX_STATE_BYTES = 16 * 1024;
const ID_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function ensureOpaqueChallengeSchema(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock($1)', [1414022212]);
    await client.query(`CREATE TABLE IF NOT EXISTS opaque_login_challenges (
    id TEXT PRIMARY KEY,
    vault_id UUID REFERENCES vaults(id) ON DELETE CASCADE,
    state TEXT NOT NULL CHECK (octet_length(state) BETWEEN 1 AND 16384),
    expires_at TIMESTAMPTZ NOT NULL
  )`);
    await client.query('CREATE INDEX IF NOT EXISTS idx_opaque_login_challenges_expiry ON opaque_login_challenges (expires_at)');
    await client.query('COMMIT');
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* preserve the original error */ }
    throw error;
  } finally { client.release(); }
}

function createOpaqueChallengeStore(pool, { ttlMs = 120_000, maxActive = 1000 } = {}) {
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1000 || ttlMs > 300_000) throw new Error('Invalid challenge lifetime');
  if (!Number.isSafeInteger(maxActive) || maxActive < 1 || maxActive > 10_000) throw new Error('Invalid challenge capacity');
  return {
    async create({ vaultId = null, state }) {
      if ((vaultId !== null && (typeof vaultId !== 'string' || !UUID_PATTERN.test(vaultId))) ||
          typeof state !== 'string' || !state || Buffer.byteLength(state, 'utf8') > MAX_STATE_BYTES) {
        throw new Error('Invalid challenge');
      }
      const id = randomBytes(32).toString('base64url');
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Shared across all server processes using this database. The cap and
        // insert must be atomic even when multiple instances start logins.
        await client.query('SELECT pg_advisory_xact_lock($1)', [1414022212]);
        await client.query('DELETE FROM opaque_login_challenges WHERE expires_at <= clock_timestamp()');
        const count = await client.query('SELECT COUNT(*)::int AS count FROM opaque_login_challenges');
        if (count.rows[0].count >= maxActive) throw new Error('Challenge capacity reached');
        await client.query('INSERT INTO opaque_login_challenges (id, vault_id, state, expires_at) VALUES ($1, $2, $3, clock_timestamp() + $4::integer * interval \'1 millisecond\')', [id, vaultId, state, ttlMs]);
        await client.query('COMMIT');
        return id;
      } catch (error) {
        try { await client.query('ROLLBACK'); } catch { /* preserve the original error */ }
        throw error;
      } finally { client.release(); }
    },
    async consume(id) {
      if (typeof id !== 'string' || !ID_PATTERN.test(id)) return null;
      // DELETE ... RETURNING makes consumption atomic across server processes.
      const result = await pool.query('DELETE FROM opaque_login_challenges WHERE id = $1 RETURNING vault_id, state, expires_at > clock_timestamp() AS fresh', [id]);
      const row = result.rows[0];
      return row?.fresh ? { vaultId: row.vault_id, state: row.state } : null;
    },
  };
}

module.exports = { ensureOpaqueChallengeSchema, createOpaqueChallengeStore };
