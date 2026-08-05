module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS gifts (
        id                  INT AUTO_INCREMENT PRIMARY KEY,
        name                VARCHAR(100) NOT NULL,
        icon                VARCHAR(10) NULL,
        image               VARCHAR(255) NULL,
        price               DECIMAL(10,2) NOT NULL DEFAULT 0,
        provider_percentage DECIMAL(5,2) NOT NULL DEFAULT 70,
        admin_percentage    DECIMAL(5,2) NOT NULL DEFAULT 30,
        is_active           TINYINT(1) NOT NULL DEFAULT 1,
        created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const [rows] = await db.query(`SELECT COUNT(*) AS total FROM gifts`);
    if (!rows.length || Number(rows[0].total) === 0) {
      await db.query(`
        INSERT INTO gifts (name, icon, price, provider_percentage, admin_percentage)
        VALUES
          ('Rose',    '🌹', 10,  70, 30),
          ('Heart',   '❤️', 20,  70, 30),
          ('Cake',    '🎂', 50,  70, 30),
          ('Diamond', '💎', 100, 70, 30),
          ('Crown',   '👑', 200, 70, 30)
      `);
    }
  },

  down: async (db) => {
    await db.query(`DROP TABLE IF EXISTS gifts`);
  },
};
