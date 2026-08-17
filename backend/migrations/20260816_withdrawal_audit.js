/**
 * Withdrawal audit & processing fields + unique human-readable reference.
 *
 * Reuses the existing `request_id` column (added by 20260704 migration, was
 * unused) as the WD-YYYYMMDD-NNNNN reference. Adds payment/processing and
 * rejection-reason fields plus an `updated_at` audit stamp.
 */

async function ensureColumn(db, col, ddl) {
    const [cols] = await db.query(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'withdraw_requests'`
    );
    const names = cols.map((c) => c.COLUMN_NAME.toLowerCase());
    if (!names.includes(col.toLowerCase())) {
        await db.query(`ALTER TABLE withdraw_requests ${ddl}`);
    }
}

module.exports = {
    up: async (db) => {
        await ensureColumn(db, 'request_id', 'ADD COLUMN request_id VARCHAR(64) NULL');
        await ensureColumn(db, 'payment_transaction_id', 'ADD COLUMN payment_transaction_id VARCHAR(255) NULL');
        await ensureColumn(db, 'payment_amount', 'ADD COLUMN payment_amount DECIMAL(15,2) NULL');
        await ensureColumn(db, 'payment_method', 'ADD COLUMN payment_method VARCHAR(20) NULL');
        await ensureColumn(db, 'payment_proof', 'ADD COLUMN payment_proof TEXT NULL');
        await ensureColumn(db, 'payment_at', 'ADD COLUMN payment_at DATETIME NULL');
        await ensureColumn(db, 'processed_by', 'ADD COLUMN processed_by INT NULL');
        await ensureColumn(db, 'processed_at', 'ADD COLUMN processed_at DATETIME NULL');
        await ensureColumn(db, 'rejection_reason', 'ADD COLUMN rejection_reason TEXT NULL');
        await ensureColumn(db, 'updated_at', 'ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

        try {
            await db.query(
                `CREATE UNIQUE INDEX IF NOT EXISTS withdraw_requests_request_id_unique ON withdraw_requests (request_id)`
            );
        } catch (e) {
            // index already exists — ignore
        }

        try {
            const [fkRows] = await db.query(
                `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'withdraw_requests'
                 AND CONSTRAINT_NAME = 'fk_wdw_processed'`
            );
            if (!fkRows.length) {
                await db.query(
                    `ALTER TABLE withdraw_requests ADD CONSTRAINT fk_wdw_processed
                     FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL`
                );
            }
        } catch (e) {
            // FK could not be added — non-fatal
        }

        // Backfill a unique reference for previously-created rows.
        await db.query(
            `UPDATE withdraw_requests
             SET request_id = CONCAT('WD-', DATE_FORMAT(created_at, '%Y%m%d'), '-', LPAD(id, 5, '0'))
             WHERE request_id IS NULL`
        );
    },

    down: async (db) => {
        const dropColumn = async (col) => {
            const [cols] = await db.query(
                `SELECT COLUMN_NAME FROM information_schema.COLUMNS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'withdraw_requests'`
            );
            const names = cols.map((c) => c.COLUMN_NAME.toLowerCase());
            if (names.includes(col.toLowerCase())) {
                await db.query(`ALTER TABLE withdraw_requests DROP COLUMN \`${col}\``);
            }
        };

        try {
            await db.query(`ALTER TABLE withdraw_requests DROP FOREIGN KEY fk_wdw_processed`);
        } catch (e) { /* ignore */ }
        try {
            await db.query(`DROP INDEX IF EXISTS withdraw_requests_request_id_unique`);
        } catch (e) { /* ignore */ }

        for (const col of ['payment_transaction_id', 'payment_amount', 'payment_method', 'payment_proof', 'payment_at', 'processed_by', 'processed_at', 'rejection_reason', 'updated_at']) {
            await dropColumn(col);
        }
    },
};