const db = require("../config/db");

const ALLOWED_PAYMENT_METHODS = ["bKash", "Nagad"];
const ALLOWED_STATUSES = ["Pending", "Approved", "Rejected", "Completed"];

// Columns returned to callers for a withdrawal request row.
const WITHDRAW_SELECT = `id, request_id, user_id, amount, method, account_number, status,
    admin_note, rejection_reason, approved_by, approved_at,
    processed_by, processed_at,
    payment_transaction_id, payment_amount, payment_method, payment_proof, payment_at,
    ledger_transaction_id, updated_at, created_at`;

async function createProviderWithdrawRequest(userId, payload = {}) {
    return createWithdrawRequest(userId, payload);
}

function normalizeMethod(method) {
    if (typeof method !== "string") return null;
    const trimmed = method.trim();
    return ALLOWED_PAYMENT_METHODS.includes(trimmed) ? trimmed : null;
}

function normalizeStatus(status) {
    if (typeof status !== "string") return null;
    const trimmed = status.trim();
    return ALLOWED_STATUSES.includes(trimmed) ? trimmed : null;
}

function isValidAmount(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 && parsed <= 100000000;
}

function isValidScreenshot(value) {
    if (typeof value !== "string" || !value.trim()) {
        return false;
    }

    const trimmed = value.trim();
    if (!trimmed.startsWith("data:image/")) {
        return false;
    }

    return /^(data:image\/(jpeg|png|jpg|gif|webp);base64,)/i.test(trimmed);
}

async function createDepositRequest(userId, payload = {}) {
    const amount = payload.amount;
    const method = normalizeMethod(payload.method);
    const trxId = String(payload.trx_id || "").trim();
    const screenshotUrl = String(payload.screenshot_url || payload.screenshot || "").trim();

    if (!isValidAmount(amount)) {
        const error = new Error("Invalid deposit amount");
        error.statusCode = 400;
        throw error;
    }

    if (!method) {
        const error = new Error("Payment method must be either bKash or Nagad");
        error.statusCode = 400;
        throw error;
    }

    if (!trxId) {
        const error = new Error("Transaction ID is required");
        error.statusCode = 400;
        throw error;
    }

    // Accept both data URLs (base64) and stored public URLs like /uploads/...
    // Upload middleware returns a URL, not a base64 data URL.
    if (screenshotUrl) {
        const looksLikeUploadedUrl = screenshotUrl.startsWith("/uploads/") || screenshotUrl.startsWith("http://") || screenshotUrl.startsWith("https://");
        if (!looksLikeUploadedUrl && !isValidScreenshot(screenshotUrl)) {
            const error = new Error("A valid image screenshot was provided but is invalid");
            error.statusCode = 400;
            throw error;
        }
    }

    const [existing] = await db.query(
        "SELECT id FROM deposit_requests WHERE trx_id = ? LIMIT 1",
        [trxId]
    );

    if (existing && existing.length) {
        const error = new Error("Transaction ID already exists");
        error.statusCode = 409;
        throw error;
    }

    const [result] = await db.query(
        `INSERT INTO deposit_requests (user_id, amount, method, trx_id, screenshot_url, status)
         VALUES (?, ?, ?, ?, ?, 'Pending')`,
        [userId, Number(amount).toFixed(2), method, trxId, screenshotUrl || ""]
    );

    const [rows] = await db.query(
        `SELECT id, user_id, amount, method, trx_id, screenshot_url, status, admin_note, approved_by, approved_at, created_at
         FROM deposit_requests WHERE id = ? LIMIT 1`,
        [result.insertId]
    );

    return rows[0];
}

async function getUserDepositHistory(userId) {
    const [rows] = await db.query(
        `SELECT id, user_id, amount, method, trx_id, screenshot_url, status, admin_note, approved_by, approved_at, created_at
         FROM deposit_requests WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
}

/**
 * createWithdrawRequest
 * ──────────────────────
 * Reserved-funds approach:
 * - Lock the user row (FOR UPDATE)
 * - Validate against the user's current available funds (users.balance for all roles;
 *   providers use a single balance wallet)
 * - Immediately deduct the amount from the correct column
 * - Insert the withdrawal request as Pending
 *
 * Approval does NOT deduct again. Rejection refunds the reserved amount.
 */
async function createWithdrawRequest(userId, payload = {}) {
    const amount = payload.amount;
    const method = normalizeMethod(payload.method);
    const accountNumber = String(payload.account_number || "").trim();

    if (!isValidAmount(amount)) {
        const error = new Error("Invalid withdrawal amount");
        error.statusCode = 400;
        throw error;
    }

    if (!method) {
        const error = new Error("Payment method must be either bKash or Nagad");
        error.statusCode = 400;
        throw error;
    }

    // bKash / Nagad: Mobile number validation
    // - Required
    // - Digits only
    // - Exactly 11 digits
    // - Bangladesh mobile format: ^01[3-9][0-9]{8}$
    if (!accountNumber) {
        const error = new Error("Mobile number is required.");
        error.statusCode = 400;
        throw error;
    }

    if (!/^\d+$/.test(accountNumber)) {
        const error = new Error("Only numbers are allowed.");
        error.statusCode = 400;
        throw error;
    }

    if (accountNumber.length !== 11) {
        const error = new Error("Mobile number must be exactly 11 digits.");
        error.statusCode = 400;
        throw error;
    }

    if (!/^01[3-9][0-9]{8}$/.test(accountNumber)) {
        const error = new Error("Please enter a valid Bangladesh mobile number.");
        error.statusCode = 400;
        throw error;
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // Lock user row so reservation + request creation are atomic and race-safe
        const [userRows] = await connection.query(
            "SELECT id, balance, earnings, role FROM users WHERE id = ? FOR UPDATE",
            [userId]
        );

        if (!userRows.length) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        const user = userRows[0];
        // Providers use a single balance wallet — all funds live in `balance`.
        const fundsField = "balance";

        const available = Number(user[fundsField] || 0);
        if (Number(amount) > available) {
            const error = new Error(
                available <= 0
                    ? "Insufficient available balance. Funds are already reserved."
                    : `Insufficient available balance. Available: ৳${available.toFixed(2)}.`
            );
            error.statusCode = 409;
            throw error;
        }

        // Reserve funds immediately by deducting from balance/earnings
        await connection.query(
            `UPDATE users SET ${fundsField} = ${fundsField} - ? WHERE id = ?`,
            [Number(amount).toFixed(2), userId]
        );

        const [result] = await connection.query(
            `INSERT INTO withdraw_requests (user_id, amount, method, account_number, status)
             VALUES (?, ?, ?, ?, 'Pending')`,
            [userId, Number(amount).toFixed(2), method, accountNumber]
        );

        // Unique, human-readable reference: WD-YYYYMMDD-NNNNN
        const yyyymmdd = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const reference = `WD-${yyyymmdd}-${String(result.insertId).padStart(5, "0")}`;
        await connection.query(
            `UPDATE withdraw_requests SET request_id = ? WHERE id = ?`,
            [reference, result.insertId]
        );

        await connection.commit();

        const [rows] = await db.query(
            `SELECT ${WITHDRAW_SELECT}
             FROM withdraw_requests WHERE id = ? LIMIT 1`,
            [result.insertId]
        );

        return rows[0];
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function getUserWithdrawHistory(userId) {
    const [rows] = await db.query(
        `SELECT ${WITHDRAW_SELECT}
         FROM withdraw_requests WHERE user_id = ? ORDER BY created_at DESC`,
        [userId]
    );
    return rows;
}

/**
 * getWalletSummary
 * ─────────────────
 * Returns:
 *   balance          — raw balance from users table
 *   earnings         — raw earnings from users table
 *   available_balance  — equals current users.balance (reservation already deducted at Pending creation)
 *   available_earnings — equals current users.earnings for providers (reservation already deducted at Pending creation)
 *   role
 *   transactions     — UNIFIED list of all activity:
 *                        • completed transactions (from transactions table)
 *                        • Pending deposit requests
 *                        • Rejected deposit requests
 *                        • Pending withdraw requests
 *                        • Rejected withdraw requests
 *                      (Approved requests are already in transactions as completed rows)
 */
async function getWalletSummary(userId) {
    const [userRows] = await db.query(
        "SELECT balance, earnings, role FROM users WHERE id = ? LIMIT 1",
        [userId]
    );

    if (!userRows.length) {
        const error = new Error("User not found");
        error.statusCode = 404;
        throw error;
    }

    const user = userRows[0];

    // ── Completed transactions ──────────────────────────────────────────────
    const [txRows] = await db.query(
        `SELECT id, type, amount, status, description, created_at
         FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 100`,
        [userId]
    );

    // ── Pending & Rejected deposit requests ─────────────────────────────────
    const [depositReqRows] = await db.query(
        `SELECT id, amount, method, trx_id, status, admin_note, created_at
         FROM deposit_requests
         WHERE user_id = ? AND status IN ('Pending', 'Rejected')
         ORDER BY created_at DESC`,
        [userId]
    );

    // ── All withdraw requests ────────────────────────────────
    const [withdrawReqRows] = await db.query(
        `SELECT id, amount, method, account_number, status, admin_note, created_at
         FROM withdraw_requests
         WHERE user_id = ?
         ORDER BY created_at DESC`,
        [userId]
    );

    const balance = Number(user.balance || 0);
    const earnings = Number(user.earnings || 0);

    // Reservation is applied immediately on Pending creation by deducting from
    // users.balance. Providers use a single balance wallet, so available funds
    // equal the current balance for all roles. `available_earnings` is retained
    // for backward compatibility but is no longer provider-specific.
    const available_balance = Math.max(0, balance);
    const available_earnings = earnings;

    // ── Map request rows to unified Transaction shape ───────────────────────
    const depositReqTx = depositReqRows.map((r) => ({
        id: `dep_req_${r.id}`,
        type: "deposit",
        amount: r.amount,
        status: r.status.toLowerCase(),   // 'pending' | 'rejected'
        description: `Deposit request via ${r.method} (TXN: ${r.trx_id})${r.admin_note ? ` — ${r.admin_note}` : ""}`,
        created_at: r.created_at,
        _source: "request",
    }));

    const withdrawReqTx = withdrawReqRows.map((r) => ({
        id: `wd_req_${r.id}`,
        type: "withdraw",
        amount: r.amount,
        status: r.status.toLowerCase(),   // 'pending' | 'rejected' | 'approved'
        description: `Withdrawal request via ${r.method} to ${r.account_number}${r.admin_note ? ` — ${r.admin_note}` : ""}`,
        created_at: r.created_at,
        method: r.method,
        account_number: r.account_number,
        _source: "request",
    }));

    // Completed txs already have the right shape; normalise status to lowercase
    const completedTx = (txRows || [])
        .filter(tx => tx.type !== 'withdraw') // Use withdraw_requests for withdrawals instead to avoid duplicates and preserve method/number
        .map((tx) => ({
            ...tx,
            status: (tx.status || "completed").toLowerCase(),
        }));

    // Merge and sort newest-first
    const allTransactions = [...depositReqTx, ...withdrawReqTx, ...completedTx].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );

    return {
        balance,
        earnings,
        available_balance,
        available_earnings,
        role: user.role,
        transactions: allTransactions,
    };
}

async function getAdminDepositRequests() {
    const [rows] = await db.query(
        `SELECT dr.id, dr.user_id, dr.amount, dr.method, dr.trx_id, dr.screenshot_url, dr.status, dr.admin_note, dr.approved_by, dr.approved_at, dr.created_at,
                u.name AS user_name, u.email AS user_email
         FROM deposit_requests dr
         LEFT JOIN users u ON u.id = dr.user_id
         ORDER BY dr.created_at DESC`
    );
    return rows;
}

async function approveDepositRequest(adminId, depositId, adminNote = "") {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [depositRows] = await connection.query(
            `SELECT id, user_id, amount, status FROM deposit_requests WHERE id = ? FOR UPDATE`,
            [depositId]
        );

        if (!depositRows.length) {
            const error = new Error("Deposit request not found");
            error.statusCode = 404;
            throw error;
        }

        const deposit = depositRows[0];
        if (deposit.status !== "Pending") {
            const error = new Error("Deposit request is no longer pending");
            error.statusCode = 400;
            throw error;
        }

        const [userRows] = await connection.query(
            `SELECT id, balance FROM users WHERE id = ? FOR UPDATE`,
            [deposit.user_id]
        );

        if (!userRows.length) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        await connection.query(
            `UPDATE users SET balance = balance + ? WHERE id = ?`,
            [Number(deposit.amount), deposit.user_id]
        );

        await connection.query(
            `INSERT INTO transactions (user_id, type, amount, status, description)
             VALUES (?, 'deposit', ?, 'completed', 'Deposit approved manually')`,
            [deposit.user_id, Number(deposit.amount)]
        );

        await connection.query(
            `UPDATE deposit_requests
             SET status = 'Approved', admin_note = ?, approved_by = ?, approved_at = NOW()
             WHERE id = ?`,
            [adminNote.trim(), adminId, depositId]
        );

        await connection.commit();

        const [updatedRows] = await db.query(
            `SELECT id, user_id, amount, method, trx_id, screenshot_url, status, admin_note, approved_by, approved_at, created_at
             FROM deposit_requests WHERE id = ? LIMIT 1`,
            [depositId]
        );

        return updatedRows[0];
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

async function rejectDepositRequest(adminId, depositId, adminNote = "") {
    const [result] = await db.query(
        `UPDATE deposit_requests
         SET status = 'Rejected', admin_note = ?, approved_by = ?, approved_at = NOW()
         WHERE id = ?`,
        [adminNote.trim(), adminId, depositId]
    );

    if (result.affectedRows === 0) {
        const error = new Error("Deposit request not found");
        error.statusCode = 404;
        throw error;
    }

    const [rows] = await db.query(
        `SELECT id, user_id, amount, method, trx_id, screenshot_url, status, admin_note, approved_by, approved_at, created_at
         FROM deposit_requests WHERE id = ? LIMIT 1`,
        [depositId]
    );

    return rows[0];
}

async function getAdminWithdrawRequests() {
    const [rows] = await db.query(
        `SELECT wr.id, wr.user_id, wr.request_id, wr.amount, wr.method, wr.account_number, wr.status,
                wr.admin_note, wr.rejection_reason, wr.approved_by, wr.approved_at,
                wr.processed_by, wr.processed_at,
                wr.payment_transaction_id, wr.payment_amount, wr.payment_method, wr.payment_proof, wr.payment_at,
                wr.ledger_transaction_id, wr.updated_at, wr.created_at,
                u.name AS user_name, u.email AS user_email, u.role AS user_role, u.balance AS user_balance,
                ap.name AS approved_by_name, pr.name AS processed_by_name
         FROM withdraw_requests wr
         LEFT JOIN users u ON u.id = wr.user_id
         LEFT JOIN users ap ON ap.id = wr.approved_by
         LEFT JOIN users pr ON pr.id = wr.processed_by
         ORDER BY wr.created_at DESC`
    );
    return rows;
}

async function approveWithdrawRequest(adminId, withdrawId, adminNote = "") {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [withdrawRows] = await connection.query(
            `SELECT id, user_id, amount, status FROM withdraw_requests WHERE id = ? FOR UPDATE`,
            [withdrawId]
        );

        if (!withdrawRows.length) {
            const error = new Error("Withdrawal request not found");
            error.statusCode = 404;
            throw error;
        }

        const withdraw = withdrawRows[0];
        if (withdraw.status !== "Pending") {
            const error = new Error("Withdrawal request is no longer pending");
            error.statusCode = 400;
            throw error;
        }

        // Money is already reserved/deducted at Pending creation time.
        // Approval marks the request as PROCESSING — it does NOT mean the money
        // has been paid yet. The ledger 'withdraw' entry + payment info are
        // recorded only when the admin completes the withdrawal.

        await connection.query(
            `UPDATE withdraw_requests
             SET status = 'Approved', admin_note = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [adminNote.trim(), adminId, withdrawId]
        );

        await connection.commit();

        const [updatedRows] = await db.query(
            `SELECT ${WITHDRAW_SELECT}
             FROM withdraw_requests WHERE id = ? LIMIT 1`,
            [withdrawId]
        );

        return updatedRows[0];
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * completeWithdrawRequest
 * ──────────────────────
 * Admin has actually paid the requester externally (bKash/Nagad) and records the
 * real payment information, transitioning Approved → Completed.
 *
 * - Only 'Approved' requests may be completed (a request can never be paid
 *   twice; Pending or Completed requests are rejected).
 * - Records payment transaction ID, actual amount paid, method, proof + admin note.
 * - Records the processing admin + timestamp.
 * - Creates the single ledger 'withdraw' entry (money is already reserved; this
 *   row is informational/audit and never deducts twice).
 */
async function completeWithdrawRequest(adminId, withdrawId, payload = {}) {
    const paymentTransactionId = String(payload.payment_transaction_id || "").trim();
    const paymentAmount = Number(payload.payment_amount);
    const paymentMethod = String(payload.payment_method || "").trim() || null;
    const paymentProof = String(payload.payment_proof || "").trim() || null;
    const adminNote = String(payload.admin_note || "").trim();

    if (!paymentTransactionId) {
        const error = new Error("Payment transaction ID is required");
        error.statusCode = 400;
        throw error;
    }
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        const error = new Error("A valid amount paid is required");
        error.statusCode = 400;
        throw error;
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [withdrawRows] = await connection.query(
            `SELECT id, user_id, amount, status FROM withdraw_requests WHERE id = ? FOR UPDATE`,
            [withdrawId]
        );

        if (!withdrawRows.length) {
            const error = new Error("Withdrawal request not found");
            error.statusCode = 404;
            throw error;
        }

        const withdraw = withdrawRows[0];
        if (withdraw.status !== "Approved") {
            const error = new Error("Withdrawal must be approved before it can be completed");
            error.statusCode = 400;
            throw error;
        }

        await connection.query(
            `UPDATE withdraw_requests
             SET status = 'Completed',
                 payment_transaction_id = ?, payment_amount = ?, payment_method = ?, payment_proof = ?,
                 payment_at = NOW(),
                 processed_by = ?, processed_at = NOW(),
                 admin_note = COALESCE(?, admin_note),
                 updated_at = NOW()
             WHERE id = ?`,
            [
                paymentTransactionId,
                paymentAmount.toFixed(2),
                paymentMethod,
                paymentProof,
                adminId,
                adminNote || null,
                withdrawId,
            ]
        );

        const description = `Withdrawal ${paymentMethod ? `via ${paymentMethod} ` : ""}ref ${paymentTransactionId}`.trim();
        const [ledgerResult] = await connection.query(
            `INSERT INTO transactions (user_id, type, amount, status, description)
             VALUES (?, 'withdraw', ?, 'completed', ?)`,
            [withdraw.user_id, Number(withdraw.amount), description]
        );

        // Link the withdrawal request to its single ledger transaction so an
        // admin can trace Withdrawal Request → Ledger Transaction → Payment TXID.
        await connection.query(
            `UPDATE withdraw_requests SET ledger_transaction_id = ? WHERE id = ?`,
            [ledgerResult.insertId, withdrawId]
        );

        await connection.commit();

        const [updatedRows] = await db.query(
            `SELECT ${WITHDRAW_SELECT}
             FROM withdraw_requests WHERE id = ? LIMIT 1`,
            [withdrawId]
        );

        return updatedRows[0];
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * rejectWithdrawRequest
 * ──────────────────────
 * Refund the reserved funds back to the user's wallet and mark the request as
 * Rejected. Requires a rejection reason (audit requirement) and only applies
 * to pending requests — rejected/completed requests can never be rejected.
 */
async function rejectWithdrawRequest(adminId, withdrawId, rejectionReason, adminNote = "") {
    const reason = String(rejectionReason || "").trim();
    if (!reason) {
        const error = new Error("A rejection reason is required");
        error.statusCode = 400;
        throw error;
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [withdrawRows] = await connection.query(
            `SELECT id, user_id, amount, status FROM withdraw_requests WHERE id = ? FOR UPDATE`,
            [withdrawId]
        );

        if (!withdrawRows.length) {
            const error = new Error("Withdrawal request not found");
            error.statusCode = 404;
            throw error;
        }

        const withdraw = withdrawRows[0];
        if (withdraw.status !== "Pending") {
            const error = new Error("Withdrawal request is no longer pending — only pending requests can be rejected");
            error.statusCode = 400;
            throw error;
        }

        // Lock user row so refund + status update are atomic
        const [userRows] = await connection.query(
            `SELECT id, balance, earnings, role FROM users WHERE id = ? FOR UPDATE`,
            [withdraw.user_id]
        );

        if (!userRows.length) {
            const error = new Error("User not found");
            error.statusCode = 404;
            throw error;
        }

        const user = userRows[0];
        // Providers use a single balance wallet — refund reserved funds to `balance`.
        const fundsField = "balance";

        // Refund reserved funds
        await connection.query(
            `UPDATE users SET ${fundsField} = ${fundsField} + ? WHERE id = ?`,
            [Number(withdraw.amount).toFixed(2), withdraw.user_id]
        );

        await connection.query(
            `UPDATE withdraw_requests
             SET status = 'Rejected', rejection_reason = ?, admin_note = ?, approved_by = ?, approved_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [reason, adminNote.trim(), adminId, withdrawId]
        );

        await connection.commit();

        const [rows] = await db.query(
            `SELECT ${WITHDRAW_SELECT}
             FROM withdraw_requests WHERE id = ? LIMIT 1`,
            [withdrawId]
        );

        return rows[0];
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    createDepositRequest,
    getUserDepositHistory,
    createWithdrawRequest,
    createProviderWithdrawRequest,
    getUserWithdrawHistory,
    getWalletSummary,
    getAdminDepositRequests,
    approveDepositRequest,
    rejectDepositRequest,
    getAdminWithdrawRequests,
    approveWithdrawRequest,
    completeWithdrawRequest,
    rejectWithdrawRequest,
};
