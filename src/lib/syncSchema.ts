/** Что синхронизируется и как опознаётся «та же самая» запись на двух
 *  устройствах. Общее для миграции схемы (db.ts) и слияния (merge.ts). */
import type { Database } from 'sql.js';

/** Все таблицы с данными пользователя. У каждой первичный ключ — id. */
export const SYNC_TABLES = [
  'goals', 'tasks', 'habits', 'habit_logs', 'progress_records', 'reflections',
  'predictions', 'time_entries', 'change_log', 'xp_log', 'achievements',
  'milestones', 'health_logs',
] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

/** Естественные ключи. Отметку привычки за день, рефлексию за день, показатель
 *  за день и награду оба устройства создают со своими случайными id — по id
 *  они разные, по смыслу одна запись. Без этого после слияния отметка
 *  «вода, 22 сентября» задвоилась бы, а UNIQUE-ограничение уронило бы вставку. */
export const NATURAL_KEYS: Partial<Record<SyncTable, string[]>> = {
  habit_logs: ['habit_id', 'date'],
  reflections: ['date'],
  health_logs: ['date', 'metric'],
  achievements: ['key'],
};

/** Время в формате, который пишет и приложение (toISOString), — строки
 *  сравниваются как время. */
const NOW_SQL = "strftime('%Y-%m-%dT%H:%M:%fZ', 'now')";

/** Отметка для записей, созданных до появления updated_at: «старее всего»,
 *  чтобы любая настоящая правка на другом устройстве её перекрывала. */
export const EPOCH = '1970-01-01T00:00:00.000Z';

function columnExists(d: Database, table: string, col: string): boolean {
  const r = d.exec(`PRAGMA table_info(${table})`)[0];
  return !!r && r.values.some((row) => row[1] === col);
}

/** Схема v2: updated_at у каждой таблицы, таблица надгробий и триггеры.
 *
 *  Триггеры, а не код стора, потому что мест записи в базу десятки (стор,
 *  синхронизация здоровья, программы, импорт) — одно забытое место тихо
 *  ломало бы слияние. База сама:
 *  - ставит updated_at при вставке без него и при изменении, где его не тронули;
 *  - пишет надгробие при удалении;
 *  - снимает надгробие, если запись с тем же id вернули (отмена удаления). */
export function applySyncSchema(d: Database) {
  d.exec(`CREATE TABLE IF NOT EXISTS tombstones (
    entity TEXT NOT NULL,
    id TEXT NOT NULL,
    deleted_at TEXT NOT NULL,
    PRIMARY KEY (entity, id)
  )`);
  for (const t of SYNC_TABLES) {
    if (!columnExists(d, t, 'updated_at')) {
      d.exec(`ALTER TABLE ${t} ADD COLUMN updated_at TEXT`);
    }
    d.exec(`UPDATE ${t} SET updated_at = '${EPOCH}' WHERE updated_at IS NULL`);
    d.exec(`
      CREATE TRIGGER IF NOT EXISTS sync_${t}_ins AFTER INSERT ON ${t} BEGIN
        UPDATE ${t} SET updated_at = ${NOW_SQL} WHERE id = NEW.id AND NEW.updated_at IS NULL;
        DELETE FROM tombstones WHERE entity = '${t}' AND id = NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS sync_${t}_upd AFTER UPDATE ON ${t}
        WHEN NEW.updated_at IS OLD.updated_at BEGIN
        UPDATE ${t} SET updated_at = ${NOW_SQL} WHERE id = NEW.id;
      END;
      CREATE TRIGGER IF NOT EXISTS sync_${t}_del AFTER DELETE ON ${t} BEGIN
        INSERT OR REPLACE INTO tombstones (entity, id, deleted_at) VALUES ('${t}', OLD.id, ${NOW_SQL});
      END;
    `);
  }
}
