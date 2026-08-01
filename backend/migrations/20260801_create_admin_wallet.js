module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_wallet (
        id         INT PRIMARY KEY,
        balance    DECIMAL(12,2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Seed exactly one wallet row
    const [rows] = await db.query(`SELECT COUNT(*) AS total FROM admin_wallet`);
    if (!rows.length || Number(rows[0].total) === 0) {
      await db.query(`INSERT INTO admin_wallet (id, balance) VALUES (1, 0)`);
    }

    await db.query(`
      CREATE TABLE IF NOT EXISTS admin_wallet_transactions (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        type         VARCHAR(50) NOT NULL,
        amount       DECIMAL(12,2) NOT NULL,
        description  VARCHAR(255) NULL,
        reference_id INT NULL,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_admin_wallet_tx_type (type),
        INDEX idx_admin_wallet_tx_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },

  down: async (db) => {
    await db.query(`DROP TABLE IF EXISTS admin_wallet_transactions`);
    await db.query(`DROP TABLE IF EXISTS admin_wallet`);
  },
};
