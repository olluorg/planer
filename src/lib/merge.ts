/** Слияние двух баз — локальной и пришедшей с другого устройства.
 *
 *  Раньше синхронизация работала по принципу «побеждает последнее сохранение»
 *  целиком: правка на телефоне, сделанная пока ноутбук был офлайн, молча
 *  затиралась при следующем синке с ноутбука. Теперь сливается каждая запись
 *  отдельно:
 *  - из двух версий одной записи побеждает более новая (updated_at);
 *  - удаление, которое новее правки, побеждает правку — и наоборот;
 *  - записи с естественным ключом (отметка привычки за день и т. п.)
 *    опознаются по нему, а не по случайному id.
 *
 *  Сливает В локальную базу. Сервер ничего не сливает и не может — он видит
 *  только шифр; результат уходит на него целиком.
 */
import type { Database, SqlValue } from 'sql.js';
import { SYNC_TABLES, NATURAL_KEYS, EPOCH, type SyncTable } from './syncSchema';

type Row = Record<string, SqlValue>;

export interface MergeStats {
  /** Записей пришло с другого устройства (новые или более свежие версии). */
  incoming: number;
  /** Записей удалено, потому что их удалили на другом устройстве. */
  deleted: number;
}

function rows(d: Database, sql: string, params: SqlValue[] = []): Row[] {
  const st = d.prepare(sql);
  try {
    st.bind(params);
    const out: Row[] = [];
    while (st.step()) out.push(st.getAsObject() as Row);
    return out;
  } finally {
    st.free();
  }
}

function run(d: Database, sql: string, params: SqlValue[] = []) {
  const st = d.prepare(sql);
  try { st.bind(params); st.step(); } finally { st.free(); }
}

const ts = (v: SqlValue | undefined) => (typeof v === 'string' && v ? v : EPOCH);

/** Колонки таблицы в ЛОКАЛЬНОЙ базе — пришедшая может быть старее и не иметь
 *  каких-то колонок; лишние колонки из неё тоже не переносим. */
function localColumns(d: Database, table: string): string[] {
  return rows(d, `PRAGMA table_info(${table})`).map((r) => String(r.name));
}

/** Automatic reconciliation is limited to disjoint inserts on the same schema.
 *  Updates, deletions, tombstones and natural-key collisions require review. */
export function canMergeIndependentInserts(base: Database, local: Database, remote: Database): boolean {
  const version = (d: Database) => d.exec('PRAGMA user_version')[0]?.values[0]?.[0];
  if (version(base) !== version(local) || version(base) !== version(remote)) return false;
  const schema = (d: Database) => JSON.stringify(rows(d, "SELECT type, name, sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' ORDER BY type, name"));
  if (schema(base) !== schema(local) || schema(base) !== schema(remote)) return false;
  const expected = [...SYNC_TABLES, 'tombstones'].sort();
  const actual = rows(base, "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map(row => String(row.name));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) return false;
  const encode = (row: Row, columns: string[]) => JSON.stringify(columns.map(column => {
    const value = row[column];
    return value instanceof Uint8Array ? Array.from(value) : value ?? null;
  }));
  const tombs = (d: Database) => JSON.stringify(rows(d, 'SELECT entity, id, deleted_at FROM tombstones ORDER BY entity, id'));
  if (tombs(base) !== tombs(local) || tombs(base) !== tombs(remote)) return false;
  for (const table of SYNC_TABLES) {
    const columns = localColumns(base, table);
    const baseRows = rows(base, `SELECT * FROM ${table}`);
    const localRows = rows(local, `SELECT * FROM ${table}`);
    const remoteRows = rows(remote, `SELECT * FROM ${table}`);
    if ([...baseRows, ...localRows, ...remoteRows].some(row => typeof row.id !== 'string' || !row.id)) return false;
    const baseById = new Map(baseRows.map(row => [String(row.id), row]));
    const localById = new Map(localRows.map(row => [String(row.id), row]));
    const remoteById = new Map(remoteRows.map(row => [String(row.id), row]));
    if (baseById.size !== baseRows.length || localById.size !== localRows.length || remoteById.size !== remoteRows.length) return false;
    for (const [id, row] of baseById) {
      const l = localById.get(id), r = remoteById.get(id);
      if (!l || !r || encode(row, columns) !== encode(l, columns) || encode(row, columns) !== encode(r, columns)) return false;
    }
    const localNew = localRows.filter(row => !baseById.has(String(row.id)));
    const remoteNew = remoteRows.filter(row => !baseById.has(String(row.id)));
    const natural = NATURAL_KEYS[table as SyncTable];
    const remoteNatural = new Map<string, string>();
    if (natural) for (const row of remoteNew) {
      const key = encode(row, natural);
      if (remoteNatural.has(key)) return false;
      remoteNatural.set(key, String(row.id));
    }
    for (const l of localNew) {
      const id = String(l.id), r = remoteById.get(id);
      if (r && encode(l, columns) !== encode(r, columns)) return false;
      const otherId = natural ? remoteNatural.get(encode(l, natural)) : undefined;
      if (otherId !== undefined && otherId !== id) return false;
    }
  }
  return true;
}

export function mergeInto(local: Database, remote: Database, missingRemoteTaskColumns: readonly string[] = []): MergeStats {
  const stats: MergeStats = { incoming: 0, deleted: 0 };
  local.exec('BEGIN');
  try {
    // 1. Надгробия: объединение, по каждой записи — самое позднее удаление.
    const tombs = new Map<string, string>();
    for (const db of [local, remote]) {
      for (const t of rows(db, 'SELECT entity, id, deleted_at FROM tombstones')) {
        const k = `${t.entity}\u0000${t.id}`;
        if (!tombs.has(k) || String(t.deleted_at) > tombs.get(k)!) tombs.set(k, String(t.deleted_at));
      }
    }
    const tombOf = (table: string, id: SqlValue) => tombs.get(`${table}\u0000${id}`);

    for (const table of SYNC_TABLES) {
      const cols = localColumns(local, table);
      const remoteCols = new Set(localColumns(remote, table));
      const shared = cols.filter((c) => remoteCols.has(c) && !(table === 'tasks' && missingRemoteTaskColumns.includes(c)));
      const natural = NATURAL_KEYS[table as SyncTable];

      // 2. Входящие версии.
      for (const r of rows(remote, `SELECT ${shared.join(', ')} FROM ${table}`)) {
        const rTime = ts(r.updated_at);
        const tomb = tombOf(table, r.id);
        if (tomb && tomb >= rTime) continue; // удалена позже, чем правилась

        let mine = rows(local, `SELECT id, updated_at FROM ${table} WHERE id = ?`, [r.id])[0];
        if (!mine && natural) {
          // Та же по смыслу запись под другим id.
          const where = natural.map((c) => `${c} IS ?`).join(' AND ');
          const twin = rows(local, `SELECT id, updated_at FROM ${table} WHERE ${where}`, natural.map((c) => r[c] ?? null))[0];
          if (twin) {
            if (ts(twin.updated_at) >= rTime) continue; // своя версия новее или та же
            // Пришедшая новее: своя уступает место. Надгробие на её id уедет на
            // сервер, и другое устройство тоже не будет её держать.
            run(local, `DELETE FROM ${table} WHERE id = ?`, [twin.id]);
          }
        }

        if (!mine) {
          const placeholders = shared.map(() => '?').join(', ');
          run(local, `INSERT INTO ${table} (${shared.join(', ')}) VALUES (${placeholders})`, shared.map((c) => r[c] ?? null));
          stats.incoming++;
        } else if (rTime > ts(mine.updated_at)) {
          const sets = shared.filter((c) => c !== 'id').map((c) => `${c} = ?`).join(', ');
          run(local, `UPDATE ${table} SET ${sets} WHERE id = ?`, [...shared.filter((c) => c !== 'id').map((c) => r[c] ?? null), r.id]);
          stats.incoming++;
        }
        // Равное время — оставляем свою: результат уедет на сервер, и
        // устройства сойдутся на одной версии.
      }

      // 3. Удаления с другого устройства, которые новее наших правок.
      for (const mineRow of rows(local, `SELECT id, updated_at FROM ${table}`)) {
        const tomb = tombOf(table, mineRow.id);
        if (tomb && tomb >= ts(mineRow.updated_at)) {
          run(local, `DELETE FROM ${table} WHERE id = ?`, [mineRow.id]);
          stats.deleted++;
        }
      }
    }

    // 4. Итоговые надгробия — в локальную базу (удаления выше могли
    //    переписать время на «сейчас» — возвращаем исходное, оно честнее).
    for (const [k, when] of tombs) {
      const [entity, id] = k.split('\u0000');
      // Запись жива — значит, её правка новее удаления; надгробие устарело.
      if (!(SYNC_TABLES as readonly string[]).includes(entity)) continue;
      if (rows(local, `SELECT 1 FROM ${entity} WHERE id = ?`, [id]).length) continue;
      run(local, 'INSERT OR REPLACE INTO tombstones (entity, id, deleted_at) VALUES (?, ?, ?)', [entity, id, when]);
    }
    local.exec('COMMIT');
  } catch (e) {
    local.exec('ROLLBACK'); // слияние либо целиком, либо никак
    throw e;
  }
  return stats;
}
