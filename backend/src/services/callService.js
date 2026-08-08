const db = require("../config/db");
const { getPartnerRequestStatus } = require("../services/chatService");
const { checkFeatureAccess } = require("../middleware/membershipMiddleware");
const platformSettingsService = require("../services/platformSettingsService");
const adminWalletService = require("../services/adminWalletService");

function calcCost(durationSeconds, rate) {
    const cost = (durationSeconds / 60) * rate;
    return Math.round(cost * 100) / 100;
}

function findCallByUserId(activeCalls, userId) {
    for (const [, call] of activeCalls) {
        if (call.callerId === userId || call.calleeId === userId) {
            return call;
        }
    }
    return null;
}

function isBusy(userId, activeCalls) {
    return findCallByUserId(activeCalls, userId) !== null;
}

function validateRoles(callerRole, calleeRole) {
    if (callerRole === calleeRole) {
        return { allowed: false, message: "Calls are only allowed between a user and a provider" };
    }
    const isPair =
        (callerRole === "user" && calleeRole === "provider") ||
        (callerRole === "provider" && calleeRole === "user");
    if (!isPair) {
        return { allowed: false, message: "Calls are only allowed between a user and a provider" };
    }
    return { allowed: true };
}

async function checkBalance(userId) {
    const rate = await platformSettingsService.getCallRate();
    const [rows] = await db.query("SELECT balance FROM users WHERE id = ?", [userId]);
    if (!rows.length) return { sufficient: false };
    const balance = Number(rows[0].balance) || 0;
    return { sufficient: balance >= rate, balance };
}

async function checkCallPermission({ callerId, calleeId, callerRole, calleeRole, onlineUsers, activeCalls }) {
    try {
        if (callerId === calleeId) {
            return { allowed: false, message: "Cannot call yourself" };
        }

        if (!onlineUsers.has(callerId)) {
            return { allowed: false, message: "You are not connected" };
        }

        if (!onlineUsers.has(calleeId)) {
            return { allowed: false, message: "User is offline" };
        }

        if (isBusy(callerId, activeCalls)) {
            return { allowed: false, message: "You are already in a call" };
        }

        if (isBusy(calleeId, activeCalls)) {
            return { allowed: false, type: "busy", message: "callee_busy" };
        }

        const roleCheck = validateRoles(callerRole, calleeRole);
        if (!roleCheck.allowed) {
            return roleCheck;
        }

        const userId = callerRole === "user" ? callerId : calleeId;
        const providerId = callerRole === "provider" ? callerId : calleeId;
        const partnerStatus = await getPartnerRequestStatus({ userId, providerId });
        if (partnerStatus !== "accepted") {
            return { allowed: false, message: "Partner request must be accepted to call" };
        }

        const callerFeature = await checkFeatureAccess(callerId, "AUDIO_CALL", callerRole);
        if (!callerFeature.allowed) {
            return { allowed: false, message: "You need AUDIO_CALL feature to make calls" };
        }

        const calleeFeature = await checkFeatureAccess(calleeId, "AUDIO_CALL", calleeRole);
        if (!calleeFeature.allowed) {
            return { allowed: false, message: "Receiver does not have AUDIO_CALL feature" };
        }

        // Balance check
        const callerBal = await checkBalance(callerId);
        if (!callerBal.sufficient) {
            return { allowed: false, message: "Insufficient wallet balance" };
        }
        const calleeBal = await checkBalance(calleeId);
        if (!calleeBal.sufficient) {
            return { allowed: false, message: "Receiver has insufficient wallet balance" };
        }

        return { allowed: true };
    } catch (err) {
        return { allowed: false, message: err.message || "Call permission check failed" };
    }
}

async function chargeForCall(callLogId, callerId, calleeId, durationSeconds, { endedAt, endedBy } = {}) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        // Cost uses the dynamic platform call rate
        const rate = await platformSettingsService.getCallRate();

        // Lock both user rows so concurrent billing attempts cannot double-spend,
        // and read their authoritative current balances.
        const [callerRows] = await connection.query(
            "SELECT balance FROM users WHERE id = ? FOR UPDATE",
            [callerId]
        );
        const [recvRows] = await connection.query(
            "SELECT balance FROM users WHERE id = ? FOR UPDATE",
            [calleeId]
        );
        const callerBalance = Math.max(0, Number(callerRows[0]?.balance) || 0);
        const receiverBalance = Math.max(0, Number(recvRows[0]?.balance) || 0);

        // Each party pays (rate/2) per minute, i.e. rate/120 per second.
        // Max seconds a balance B can fund = B * 120 / rate.
        const maxAffordableSeconds = Math.min(
            callerBalance * 120 / rate,
            receiverBalance * 120 / rate,
            durationSeconds
        );
        let billableSeconds = Math.floor(Math.max(0, maxAffordableSeconds));

        // Cent-based split guarantees callerCost + receiverCost === totalCost exactly.
        const computeCosts = (secs) => {
            const totalCents = Math.round((secs / 60) * rate * 100);
            const callerCents = Math.round(totalCents / 2);
            const receiverCents = totalCents - callerCents;
            return {
                totalCents,
                callerCents,
                receiverCents,
            };
        };

        let costs = computeCosts(billableSeconds);
        // Guard against cent-rounding pushing a share above the party's balance.
        while (
            billableSeconds > 0 &&
            (costs.callerCents / 100 > callerBalance || costs.receiverCents / 100 > receiverBalance)
        ) {
            billableSeconds -= 1;
            costs = computeCosts(billableSeconds);
        }

        const totalCost = costs.totalCents / 100;
        const callerCost = costs.callerCents / 100;
        const receiverCost = costs.receiverCents / 100;

        // Deduct caller balance (guaranteed not to go negative)
        await connection.query("UPDATE users SET balance = balance - ? WHERE id = ?", [callerCost, callerId]);

        // Deduct receiver balance (guaranteed not to go negative)
        await connection.query("UPDATE users SET balance = balance - ? WHERE id = ?", [receiverCost, calleeId]);

        if (callerCost > 0) {
            // Caller transaction
            await connection.query(
                "INSERT INTO transactions (user_id, type, amount, status, description, created_at) VALUES (?, 'audio_call', ?, 'completed', ?, NOW())",
                [callerId, -callerCost, `Audio call charge (#${callLogId})`]
            );
        }
        if (receiverCost > 0) {
            // Receiver transaction
            await connection.query(
                "INSERT INTO transactions (user_id, type, amount, status, description, created_at) VALUES (?, 'audio_call', ?, 'completed', ?, NOW())",
                [calleeId, -receiverCost, `Audio call charge (#${callLogId})`]
            );
        }

        // Finalise call_log cost fields atomically (duration recorded = billable portion)
        await connection.query(
            `UPDATE call_logs SET cost = ?, caller_cost = ?, receiver_cost = ?,
                 ended_at = COALESCE(?, ended_at), duration_seconds = COALESCE(?, duration_seconds), ended_by = COALESCE(?, ended_by)
             WHERE id = ?`,
            [totalCost, callerCost, receiverCost, endedAt || null, billableSeconds, endedBy || null, callLogId]
        );

        // Credit Admin Wallet with the full (billable) call cost on the SAME connection/transaction
        if (totalCost > 0) {
            await adminWalletService.credit(
                totalCost,
                "audio_call_income",
                `Audio call income (#${callLogId})`,
                callLogId,
                connection
            );
        }

        await connection.commit();
        return { totalCost, callerCost, receiverCost, billableSeconds, durationSeconds };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function getCallById(callId, userId) {
    const [rows] = await db.query(
        `SELECT c.*,
                caller.name AS caller_name,
                callee.name AS callee_name
         FROM call_logs c
         JOIN users caller ON caller.id = c.caller_id
         JOIN users callee ON callee.id = c.callee_id
         WHERE c.id = ? AND (c.caller_id = ? OR c.callee_id = ?)`,
        [callId, userId, userId]
    );
    return rows.length ? rows[0] : null;
}

async function getFilteredCallHistory({ userId, role, filter, search, page = 1, limit = 20 }) {
    const offset = (page - 1) * limit;
    const conditions = ["(c.caller_id = ? OR c.callee_id = ?)"];
    const params = [userId, userId];

    // Admin can view all
    if (role === "admin") {
        conditions.length = 0;
        params.length = 0;
    }

    // Direction filter
    if (filter === "incoming") {
        conditions.push("c.callee_id = ?");
        params.push(userId);
    } else if (filter === "outgoing") {
        conditions.push("c.caller_id = ?");
        params.push(userId);
    }

    // Status filter
    if (filter === "missed") {
        conditions.push("c.status = 'missed'");
    } else if (filter === "rejected") {
        conditions.push("c.status IN ('rejected','cancelled')");
    }

    // Search by peer name
    if (search) {
        conditions.push("(caller.name LIKE ? OR callee.name LIKE ?)");
        const s = `%${search}%`;
        params.push(s, s);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    // Count total
    const [countRows] = await db.query(
        `SELECT COUNT(*) AS total
         FROM call_logs c
         JOIN users caller ON caller.id = c.caller_id
         JOIN users callee ON callee.id = c.callee_id
         ${where}`,
        params
    );
    const total = countRows[0]?.total || 0;

    // Fetch page
    const [rows] = await db.query(
        `SELECT c.*,
                caller.name AS caller_name,
                callee.name AS callee_name
         FROM call_logs c
         JOIN users caller ON caller.id = c.caller_id
         JOIN users callee ON callee.id = c.callee_id
         ${where}
         ORDER BY c.created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, limit, offset]
    );

    return { calls: rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}

module.exports = { findCallByUserId, isBusy, validateRoles, checkCallPermission, checkBalance, chargeForCall, calcCost, getCallById, getFilteredCallHistory };
