import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import pg from 'pg';

const require = createRequire(import.meta.url);
const { createOpaqueChallengeStore, ensureOpaqueChallengeSchema } = require('../opaque-challenges.cjs');

test('rejects invalid challenge inputs without contacting the database', async () => {
  const pool = { connect() { throw new Error('unexpected database call'); }, query() { throw new Error('unexpected database call'); } };
  for (const options of [{ ttlMs: 999 }, { ttlMs: 300001 }, { maxActive: 0 }, { maxActive: 10001 }]) {
    assert.throws(() => createOpaqueChallengeStore(pool, options));
  }
  const store = createOpaqueChallengeStore(pool);
  for (const input of [{ state: '' }, { state: 'x', vaultId: 'invalid' }, { state: 'я'.repeat(8193) }]) {
    await assert.rejects(store.create(input), /Invalid challenge/);
  }
  assert.equal(await store.consume('invalid'), null);
});

test('Postgres enforces capacity, expiry and one-time consumption across stores', { skip: !process.env.OPAQUE_TEST_DATABASE_URL, timeout: 30000 }, async () => {
  const connectionString = process.env.OPAQUE_TEST_DATABASE_URL;
  const schema = `opaque_test_${randomBytes(8).toString('hex')}`;
  const admin = new pg.Pool({ connectionString });
  let pool;
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    pool = new pg.Pool({ connectionString, options: `-c search_path=${schema}` });
    await pool.query('CREATE TABLE vaults (id UUID PRIMARY KEY)');
    const vaultId = '11111111-1111-4111-8111-111111111111';
    await pool.query('INSERT INTO vaults (id) VALUES ($1)', [vaultId]);
    await Promise.all([ensureOpaqueChallengeSchema(pool), ensureOpaqueChallengeSchema(pool)]);
    const stores = [createOpaqueChallengeStore(pool, { maxActive: 2 }), createOpaqueChallengeStore(pool, { maxActive: 2 })];
    const creations = await Promise.allSettled(Array.from({ length: 3 }, (_, i) => stores[i % 2].create({ vaultId, state: `state-${i}` })));
    const ids = creations.filter(result => result.status === 'fulfilled').map(result => result.value);
    assert.equal(ids.length, 2);
    assert.equal(creations.filter(result => result.status === 'rejected').length, 1);
    const attempts = await Promise.all(Array.from({ length: 10 }, (_, i) => stores[i % 2].consume(ids[0])));
    assert.equal(attempts.filter(Boolean).length, 1);
    assert.equal(attempts.find(Boolean).vaultId, vaultId);
    await pool.query("UPDATE opaque_login_challenges SET expires_at = clock_timestamp() - interval '1 second' WHERE id = $1", [ids[1]]);
    const decoy = await stores[0].create({ state: 'decoy' });
    assert.equal(await stores[1].consume(ids[1]), null);
    assert.deepEqual(await stores[1].consume(decoy), { vaultId: null, state: 'decoy' });
    const removed = await stores[0].create({ vaultId, state: 'removed' });
    await pool.query('DELETE FROM vaults WHERE id = $1', [vaultId]);
    assert.equal(await stores[1].consume(removed), null);
  } finally {
    if (pool) await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await admin.end();
  }
});
