/**
 * Link each completed withdrawal to its single ledger transaction.
 *
 * `ledger_transaction_id` stores the `transactions.id` created when a withdrawal
 * is completed, and a UNIQUE index prevents a withdrawal from ever being linked
 * to (or created with) more than one payout ledger row.
 */

module.exports = {
    up: async (db) => {
        const [cols] = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'withdraw_requests'`
        );
        const names = cols.map((c) => c.COLUMN_NAME.toLowerCase());

        if (!names.includes('ledger_transaction_id')) {
            await db.query(`ALTER TABLE withdraw_requests ADD COLUMN ledger_transaction_id INT NULL`);
        }

        try {
            await db.query(
                `CREATE UNIQUE INDEX IF NOT EXISTS withdraw_requests_ledger_transaction_id_unique
                 ON withdraw_requests (ledger_transaction_id)`
            );
        } catch (e) {
            // index already exists — ignore
        }
    },

    down: async (db) => {
        try {
            await db.query(`DROP INDEX IF EXISTS withdraw_requests_ledger_transaction_id_unique`);
        } catch (e) { /* ignore */ }

        const [cols] = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'withdraw_requests'`
        );
        const names = cols.map((c) => c.COLUMN_NAME.toLowerCase());
        if (names.includes('ledger_transaction_id')) {
            await db.query(`ALTER TABLE withdraw_requests DROP COLUMN ledger_transaction_id`);
        }
    },
};