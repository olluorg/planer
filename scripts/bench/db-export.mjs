import initSqlJs from 'sql.js';
import fs from 'node:fs';
const SQL = await initSqlJs({ wasmBinary: fs.readFileSync('node_modules/sql.js/dist/sql-wasm.wasm') });
for (const mb of [0.2, 1, 5, 20]) {
  const db = new SQL.Database();
  db.exec('CREATE TABLE t (id TEXT PRIMARY KEY, title TEXT, notes TEXT, date TEXT)');
  const rowBytes = 400, rows = Math.round(mb * 1024 * 1024 / rowBytes);
  db.exec('BEGIN');
  const st = db.prepare('INSERT INTO t VALUES (?,?,?,?)');
  for (let i = 0; i < rows; i++) st.run([`id${i}`, `Задача номер ${i}`, 'x'.repeat(300), '2026-09-22']);
  st.free(); db.exec('COMMIT');
  db.export(); // прогрев
  const n = 10, t0 = performance.now();
  for (let i = 0; i < n; i++) db.export();
  const ms = (performance.now() - t0) / n;
  console.log(`${String(mb).padStart(4)} МБ (${rows} строк): export ${ms.toFixed(1)} мс, файл ${(db.export().length/1048576).toFixed(1)} МБ`);
}
