const db = require("../config/db");

const METHODS = new Set(["bkash", "nagad"]);
const ACCOUNT_TYPES = new Set(["personal", "agent"]);
// Bangladesh mobile: 01[3-9] followed by 8 digits (11 total) — matches the
// project's existing mobile-validation convention (see walletService).
const BD_MOBILE = /^01[3-9][0-9]{8}$/;

function normalizeMethod(v) {
    if (typeof v !== "string") return null;
    const m = v.trim().toLowerCase();
    return METHODS.has(m) ? m : null;
}

function normalizeAccountType(v) {
    if (typeof v !== "string") return null;
    const t = v.trim().toLowerCase();
    return ACCOUNT_TYPES.has(t) ? t : null;
}

function normalizeAccountNumber(v) {
    if (typeof v !== "string") return null;
    const digits = v.replace(/\D/g, "");
    return BD_MOBILE.test(digits) ? digits : null;
}

function toRow(row) {
    return {
        id: row.id,
        method: row.method,
        account_number: row.account_number,
        account_type: row.account_type,
        is_active: Number(row.is_active),
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

function validationError(msg) {
    const err = new Error(msg);
    err.statusCode = 400;
    return err;
}

async function listMethods({ includeInactive = false } = {}) {
    const where = includeInactive ? "" : "WHERE is_active = 1";
    const [rows] = await db.query(
        `SELECT id, method, account_number, account_type, is_active, created_at, updated_at
         FROM deposit_payment_methods ${where}
         ORDER BY method ASC, account_type ASC, id ASC`
    );
    return rows.map(toRow);
}

async function getActiveMethods() {
    return listMethods({ includeInactive: false });
}

async function getMethodById(id) {
    const [rows] = await db.query(
        `SELECT id, method, account_number, account_type, is_active, created_at, updated_at
         FROM deposit_payment_methods WHERE id = ? LIMIT 1`,
        [id]
    );
    return rows.length ? toRow(rows[0]) : null;
}

/**
 * Atomically ensures only one ACTIVE row per `method`: when a method is being
 * activated, every other active row of the same method is deactivated first.
 */
async function deactivateOthers(connection, method, excludeId) {
    if (excludeId == null) {
        await connection.query(
            `UPDATE deposit_payment_methods SET is_active = 0 WHERE method = ? AND is_active = 1`,
            [method]
        );
    } else {
        await connection.query(
            `UPDATE deposit_payment_methods SET is_active = 0 WHERE method = ? AND is_active = 1 AND id != ?`,
            [method, excludeId]
        );
    }
}

async function createMethod({ method, account_number, account_type, is_active = true }) {
    const m = normalizeMethod(method);
    const t = normalizeAccountType(account_type);
    const num = normalizeAccountNumber(account_number);

    if (!m) throw validationError('method must be "bkash" or "nagad"');
    if (!t) throw validationError('account_type must be "personal" or "agent"');
    if (!num) throw validationError('account_number must be a valid Bangladesh mobile number (01[3-9]XXXXXXXX)');

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        if (is_active) {
            await deactivateOthers(connection, m);
        }

        const [result] = await connection.query(
            `INSERT INTO deposit_payment_methods (method, account_number, account_type, is_active)
             VALUES (?, ?, ?, ?)`,
            [m, num, t, is_active ? 1 : 0]
        );

        await connection.commit();
        return getMethodById(result.insertId);
    } catch (err) {
        await connection.rollback();
        if (err && err.code === "ER_DUP_ENTRY") {
            const dup = new Error("A payment method with this method + account type already exists");
            dup.statusCode = 409;
            throw dup;
        }
        throw err;
    } finally {
        connection.release();
    }
}

async function updateMethod(id, { account_number, account_type, is_active } = {}) {
    const current = await getMethodById(id);
    if (!current) {
        const err = new Error("Payment method not found");
        err.statusCode = 404;
        throw err;
    }

    const nextType = account_type !== undefined ? normalizeAccountType(account_type) : current.account_type;
    const nextNum = account_number !== undefined ? normalizeAccountNumber(account_number) : current.account_number;
    const nextActive = is_active !== undefined ? !!is_active : Boolean(current.is_active === 1);

    if (account_type !== undefined && !nextType) throw validationError('account_type must be "personal" or "agent"');
    if (account_number !== undefined && !nextNum) throw validationError('account_number must be a valid Bangladesh mobile number (01[3-9]XXXXXXXX)');

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        if (nextActive) {
            await deactivateOthers(connection, current.method, id);
        }

        await connection.query(
            `UPDATE deposit_payment_methods
             SET account_number = ?, account_type = ?, is_active = ?
             WHERE id = ?`,
            [nextNum, nextType, nextActive ? 1 : 0, id]
        );

        await connection.commit();
        return getMethodById(id);
    } catch (err) {
        await connection.rollback();
        if (err && err.code === "ER_DUP_ENTRY") {
            const dup = new Error("A payment method with this method + account type already exists");
            dup.statusCode = 409;
            throw dup;
        }
        throw err;
    } finally {
        connection.release();
    }
}

async function toggleMethod(id, isActive) {
    const current = await getMethodById(id);
    if (!current) {
        const err = new Error("Payment method not found");
        err.statusCode = 404;
        throw err;
    }

    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        if (isActive) {
            await deactivateOthers(connection, current.method, id);
        }

        await connection.query(
            `UPDATE deposit_payment_methods SET is_active = ? WHERE id = ?`,
            [isActive ? 1 : 0, id]
        );

        await connection.commit();
        return getMethodById(id);
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

module.exports = {
    listMethods,
    getActiveMethods,
    getMethodById,
    createMethod,
    updateMethod,
    toggleMethod,
};