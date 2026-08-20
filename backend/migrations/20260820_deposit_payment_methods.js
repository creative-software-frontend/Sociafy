/**
 * deposit_payment_methods — admin-controlled bKash/Nagad deposit destinations.
 *
 * Each row is one payment method configuration:
 *   method         'bkash' | 'nagad'
 *   account_number  BD mobile (01[3-9]XXXXXXXX, 11 digits)
 *   account_type    'personal' | 'agent'
 *   is_active       only ACTIVE methods are exposed to users/providers
 *
 * At most one row per (method, account_type). Activating a method atomically
 * deactivates the other active rows of the same `method`.
 */

module.exports = {
    up: async (db) => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS deposit_payment_methods (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                method         VARCHAR(10) NOT NULL,
                account_number VARCHAR(20) NOT NULL,
                account_type   VARCHAR(10) NOT NULL DEFAULT 'personal',
                is_active      TINYINT(1)  NOT NULL DEFAULT 1,
                created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_dpm_method_type (method, account_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        const [cols] = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'deposit_payment_methods'`
        );
        if (!cols.length) {
            throw new Error('deposit_payment_methods table was not created');
        }
    },

    down: async (db) => {
        await db.query(`DROP TABLE IF EXISTS deposit_payment_methods`);
    },
};