module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS gift_transactions (
        id              INT AUTO_INCREMENT PRIMARY KEY,
        sender_id       INT NOT NULL,
        receiver_id     INT NOT NULL,
        gift_id         INT NOT NULL,
        gift_price      DECIMAL(10,2) NOT NULL,
        provider_amount DECIMAL(10,2) NOT NULL,
        admin_amount    DECIMAL(10,2) NOT NULL,
        message_id      INT NULL,
        created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_gt_sender   (sender_id),
        INDEX idx_gt_receiver (receiver_id),
        INDEX idx_gt_created  (created_at),
        CONSTRAINT fk_gt_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_gt_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_gt_gift     FOREIGN KEY (gift_id)     REFERENCES gifts(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // Add gift types to the transactions type ENUM
    try {
      await db.query(`ALTER TABLE transactions MODIFY COLUMN type ENUM('deposit','withdraw','earning','event_payment','event_income','membership_purchase','audio_call','gift_purchase','gift_income') NOT NULL`);
    } catch (e) { /* already modified */ }
  },

  down: async (db) => {
    await db.query(`DROP TABLE IF EXISTS gift_transactions`);
    try {
      await db.query(`ALTER TABLE transactions MODIFY COLUMN type ENUM('deposit','withdraw','earning','event_payment','event_income','membership_purchase','audio_call') NOT NULL`);
    } catch (e) { /* ok */ }
  },
};
