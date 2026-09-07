import type { Store, RecordData } from './service';
export function d1Store(db: D1Database): Store {
  return {
    async get(key) {
      const row = await db
        .prepare('SELECT value FROM records WHERE key = ?')
        .bind(key)
        .first<{ value: string }>();
      return row ? JSON.parse(row.value) : null;
    },
    async list(prefix) {
      const rows = await db
        .prepare(
          'SELECT value FROM records WHERE key >= ? AND key < ? ORDER BY key',
        )
        .bind(prefix, prefix + '\uffff')
        .all<{ value: string }>();
      return rows.results.map((r) => JSON.parse(r.value));
    },
    async put(key, value, expected) {
      let result;
      if (expected === null)
        result = await db
          .prepare(
            'INSERT OR IGNORE INTO records (key,value,version) VALUES (?,?,?)',
          )
          .bind(key, JSON.stringify(value), value.version)
          .run();
      else if (expected !== undefined)
        result = await db
          .prepare(
            'UPDATE records SET value = ?, version = ? WHERE key = ? AND version = ?',
          )
          .bind(JSON.stringify(value), value.version, key, expected)
          .run();
      else
        result = await db
          .prepare(
            'INSERT INTO records (key,value,version) VALUES (?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,version=excluded.version',
          )
          .bind(key, JSON.stringify(value), value.version)
          .run();
      return result.meta.changes === 1;
    },
  };
}
