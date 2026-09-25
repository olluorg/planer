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

export function mergeInto(local: Database, remote: Database): MergeStats {
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
      const shared = cols.filter((c) => remoteCols.has(c));
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
