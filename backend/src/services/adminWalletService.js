const db = require("../config/db");

async function getBalance() {
    const [rows] = await db.query("SELECT balance FROM admin_wallet WHERE id = 1 LIMIT 1");
    if (!rows.length) return 0;
    return Number(rows[0].balance) || 0;
}

async function credit(amount, type, description, referenceId = null, connection = null) {
    const q = connection || db;
    await q.query("UPDATE admin_wallet SET balance = balance + ? WHERE id = 1", [amount]);
    await q.query(
        "INSERT INTO admin_wallet_transactions (type, amount, description, reference_id) VALUES (?, ?, ?, ?)",
        [type, amount, description, referenceId]
    );
}

async function debit(amount, type, description, referenceId = null, connection = null) {
    const q = connection || db;
    await q.query("UPDATE admin_wallet SET balance = balance - ? WHERE id = 1", [amount]);
    await q.query(
        "INSERT INTO admin_wallet_transactions (type, amount, description, reference_id) VALUES (?, ?, ?, ?)",
        [type, -amount, description, referenceId]
    );
}

async function getTransactions(limit = 200) {
    const [rows] = await db.query(
        "SELECT * FROM admin_wallet_transactions ORDER BY created_at DESC LIMIT ?",
        [limit]
    );
    return rows;
}

async function getSummary() {
    const balance = await getBalance();
    const [membership] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM admin_wallet_transactions WHERE type = 'membership_income'"
    );
    const [calls] = await db.query(
        "SELECT COALESCE(SUM(amount), 0) AS total FROM admin_wallet_transactions WHERE type = 'audio_call_income'"
    );
    const [withdrawals] = await db.query(
        "SELECT COALESCE(SUM(ABS(amount)), 0) AS total FROM admin_wallet_transactions WHERE type = 'withdraw'"
    );
    return {
        balance,
        totalMembershipIncome: Number(membership[0].total) || 0,
        totalCallIncome: Number(calls[0].total) || 0,
        totalWithdrawals: Number(withdrawals[0].total) || 0,
    };
}

async function withdraw({ amount, method, trxId }) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const [rows] = await connection.query(
            "SELECT balance FROM admin_wallet WHERE id = 1 FOR UPDATE"
        );
        const balance = rows.length ? Number(rows[0].balance) || 0 : 0;

        if (amount > balance) {
            const err = new Error("Cannot withdraw more than balance");
            err.statusCode = 400;
            throw err;
        }

        await connection.query("UPDATE admin_wallet SET balance = balance - ? WHERE id = 1", [amount]);
        await connection.query(
            "INSERT INTO admin_wallet_transactions (type, amount, description, reference_id) VALUES ('withdraw', ?, ?, ?)",
            [-amount, `Withdraw via ${method || 'manual'} (${trxId || 'N/A'})`, null]
        );

        await connection.commit();
        return { success: true, amount };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

module.exports = { getBalance, credit, debit, getTransactions, getSummary, withdraw };
