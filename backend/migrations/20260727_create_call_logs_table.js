module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS call_logs (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        caller_id         INT NOT NULL,
        callee_id         INT NOT NULL,
        status            ENUM('connected','missed','rejected','busy','cancelled','failed') NOT NULL DEFAULT 'connected',
        call_type         VARCHAR(10) NOT NULL DEFAULT 'audio',
        started_at        TIMESTAMP NULL,
        ended_at          TIMESTAMP NULL,
        duration_seconds  INT NULL,
        ended_by          INT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_caller_id   (caller_id),
        INDEX idx_callee_id   (callee_id),
        INDEX idx_created_at  (created_at),
        CONSTRAINT fk_cl_caller FOREIGN KEY (caller_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_cl_callee FOREIGN KEY (callee_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },

  down: async (db) => {
    await db.query(`DROP TABLE IF EXISTS call_logs`);
  },
};
