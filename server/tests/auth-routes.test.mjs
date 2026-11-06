import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';

test('credential routes reject malformed and oversized bodies without limiting vault uploads', async () => {
  const port = await new Promise((resolve, reject) => {
    const listener = createServer();
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', () => {
      const { port: selected } = listener.address();
      listener.close(() => resolve(selected));
    });
  });
  const preload = new URL('./fake-pg.mjs', import.meta.url).href;
  const server = fileURLToPath(new URL('../index.js', import.meta.url));
  const child = spawn(process.execPath, ['--import', preload, server], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  const base = `http://127.0.0.1:${port}`;
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error(`Server exited before readiness: ${child.exitCode}\n${stderr}`);
      try { ready = (await fetch(`${base}/health`)).ok; } catch { /* still starting */ }
      if (!ready) await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready, 'server did not start');
    const post = (route, body) => fetch(`${base}${route}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post('/register', { email: 'x@example.com', password: {}, salt: 'salt' })).status, 400);
    assert.equal((await post('/register', { email: 'x@example.com', password: 'password', salt: {} })).status, 400);
    assert.equal((await post('/login', { email: 'x@example.com', password: {} })).status, 400);
    assert.equal((await post('/login', { email: 'x@example.com', password: 'x'.repeat(20_000) })).status, 413);
    assert.equal((await post('/register', { email: 'x@example.com', password: 'x'.repeat(20_000), salt: 'salt' })).status, 413);
    assert.equal((await post('/login', { email: 'x@example.com', password: 'password' })).status, 401);
    const upload = await fetch(`${base}/vault/00000000-0000-4000-8000-000000000001`, {
      method: 'PUT', headers: { 'content-type': 'application/json', authorization: 'Bearer test' },
      body: JSON.stringify({ ciphertext: 'x'.repeat(20_000), expectedRevision: 0 }),
    });
    assert.equal(upload.status, 200);
    assert.equal((await fetch(`${base}/health`)).status, 200);
  } finally {
    if (child.exitCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve));
      child.kill('SIGTERM');
      await exited;
    }
  }
});
