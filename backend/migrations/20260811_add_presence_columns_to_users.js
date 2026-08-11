/**
 * Add presence columns to users — last_seen + is_online.
 *
 * authMiddleware writes `UPDATE users SET last_seen = NOW(), is_online = 1`
 * on every authenticated request, and providerRoutes reads both columns for the
 * provider dashboard presence indicator. Databases created before the presence
 * feature landed are missing them, which surfaces as:
 *
 *   Unknown column 'last_seen' in 'field list'
 *
 * Both columns are added together because they are a single presence feature
 * (the migration mirrors 20260101_create_core_schema.js, which declares them
 * as `last_seen TIMESTAMP NULL` and `is_online TINYINT(1) DEFAULT 0`).
 *
 * Guarded via information_schema so it is idempotent: safe on a fresh
 * database, an existing database, an already-upgraded database, and repeated
 * runs / backend restarts.
 */

module.exports = {
  up: async (db) => {
    const columnExists = async (table, column) => {
      const [rows] = await db.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [table, column]
      );
      return rows.length > 0;
    };
    const ensureColumn = async (table, column, ddl) => {
      if (!(await columnExists(table, column))) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };

    await ensureColumn('users', 'last_seen', 'last_seen TIMESTAMP NULL');
    await ensureColumn('users', 'is_online', 'is_online TINYINT(1) DEFAULT 0');
  },

  down: async (db) => {
    const columnExists = async (table, column) => {
      const [rows] = await db.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [table, column]
      );
      return rows.length > 0;
    };
    if (await columnExists('users', 'last_seen')) {
      await db.query("ALTER TABLE users DROP COLUMN last_seen");
    }
    if (await columnExists('users', 'is_online')) {
      await db.query("ALTER TABLE users DROP COLUMN is_online");
    }
  },
};
