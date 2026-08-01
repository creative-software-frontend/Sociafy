module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS platform_settings (
        id                   INT PRIMARY KEY,
        call_rate_per_minute DECIMAL(10,2) NOT NULL DEFAULT 2.00,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed exactly one settings row
    const [rows] = await db.query(`SELECT COUNT(*) AS total FROM platform_settings`);
    if (!rows.length || Number(rows[0].total) === 0) {
      await db.query(`INSERT INTO platform_settings (id, call_rate_per_minute) VALUES (1, 2.00)`);
    }
  },

  down: async (db) => {
    await db.query(`DROP TABLE IF EXISTS platform_settings`);
  },
};
