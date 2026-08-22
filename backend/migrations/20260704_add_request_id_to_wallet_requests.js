/**
 * Add request_id columns to wallet requests tables (deposit_requests, withdraw_requests)
 * - request_id is unique per table
 */

module.exports = {
  up: async (db) => {
    const columnExists = async (table, column) => {
      const [rows] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows.length > 0;
    };
    const indexExists = async (table, index) => {
      const [rows] = await db.query(
        `SELECT INDEX_NAME FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
        [table, index]
      );
      return rows.length > 0;
    };

    if (!(await columnExists('deposit_requests', 'request_id'))) {
      await db.query('ALTER TABLE deposit_requests ADD COLUMN request_id VARCHAR(64) NULL');
    }
    if (!(await columnExists('withdraw_requests', 'request_id'))) {
      await db.query('ALTER TABLE withdraw_requests ADD COLUMN request_id VARCHAR(64) NULL');
    }

    if (!(await indexExists('deposit_requests', 'deposit_requests_request_id_unique'))) {
      await db.query('CREATE UNIQUE INDEX deposit_requests_request_id_unique ON deposit_requests(request_id)');
    }
    if (!(await indexExists('withdraw_requests', 'withdraw_requests_request_id_unique'))) {
      await db.query('CREATE UNIQUE INDEX withdraw_requests_request_id_unique ON withdraw_requests(request_id)');
    }
  },

  down: async (db) => {
    const columnExists = async (table, column) => {
      const [rows] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [table, column]
      );
      return rows.length > 0;
    };
    const dropIndex = async (table, index) => {
      try { await db.query(`DROP INDEX ${index} ON ${table}`); } catch (e) { /* already absent */ }
    };

    await dropIndex('deposit_requests', 'deposit_requests_request_id_unique');
    await dropIndex('withdraw_requests', 'withdraw_requests_request_id_unique');
    if (await columnExists('deposit_requests', 'request_id')) await db.query('ALTER TABLE deposit_requests DROP COLUMN request_id');
    if (await columnExists('withdraw_requests', 'request_id')) await db.query('ALTER TABLE withdraw_requests DROP COLUMN request_id');
  }
};

