// Only used by the server route test: exercises the real HTTP stack without a database.
import pg from 'pg';

pg.Pool = class FakePool {
  on() {}
  async query(sql) {
    if (sql.startsWith('SELECT * FROM vaults WHERE auth_token')) {
      return { rows: [{ id: '00000000-0000-4000-8000-000000000001' }], rowCount: 1 };
    }
    if (sql.startsWith('UPDATE vaults SET ciphertext')) return { rows: [{ revision: 1 }], rowCount: 1 };
    return { rows: [], rowCount: 0 };
  }
  async end() {}
};
