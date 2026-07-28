module.exports = {
  up: async (db) => {
    // Add cost columns to call_logs
    try {
      await db.query(`ALTER TABLE call_logs ADD COLUMN cost DECIMAL(10,2) NULL AFTER duration_seconds`);
    } catch (e) { /* already exists */ }
    try {
      await db.query(`ALTER TABLE call_logs ADD COLUMN caller_cost DECIMAL(10,2) NULL AFTER cost`);
    } catch (e) { /* already exists */ }
    try {
      await db.query(`ALTER TABLE call_logs ADD COLUMN receiver_cost DECIMAL(10,2) NULL AFTER caller_cost`);
    } catch (e) { /* already exists */ }

    // Add audio_call to transactions type enum
    try {
      await db.query(`ALTER TABLE transactions MODIFY COLUMN type ENUM('deposit','withdraw','earning','event_payment','event_income','membership_purchase','audio_call') NOT NULL`);
    } catch (e) { /* already modified */ }
  },

  down: async (db) => {
    try {
      await db.query(`ALTER TABLE call_logs DROP COLUMN IF EXISTS receiver_cost`);
    } catch (e) { /* ok */ }
    try {
      await db.query(`ALTER TABLE call_logs DROP COLUMN IF EXISTS caller_cost`);
    } catch (e) { /* ok */ }
    try {
      await db.query(`ALTER TABLE call_logs DROP COLUMN IF EXISTS cost`);
    } catch (e) { /* ok */ }
    try {
      await db.query(`ALTER TABLE transactions MODIFY COLUMN type ENUM('deposit','withdraw','earning','event_payment','event_income','membership_purchase') NOT NULL`);
    } catch (e) { /* ok */ }
  },
};
