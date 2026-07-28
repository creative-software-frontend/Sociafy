const db = require("../config/db");
const { getPartnerRequestStatus } = require("../services/chatService");
const { checkFeatureAccess } = require("../middleware/membershipMiddleware");

const CALL_RATE_PER_MINUTE = 2.00;

function calcCost(durationSeconds) {
    const cost = (durationSeconds / 60) * CALL_RATE_PER_MINUTE;
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
    const [rows] = await db.query("SELECT balance FROM users WHERE id = ?", [userId]);
    if (!rows.length) return { sufficient: false };
    const balance = Number(rows[0].balance) || 0;
    return { sufficient: balance >= CALL_RATE_PER_MINUTE, balance };
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

async function chargeForCall(callLogId, callerId, calleeId, durationSeconds) {
    const totalCost = calcCost(durationSeconds);
    const callerCost = Math.round((totalCost / 2) * 100) / 100;
    const receiverCost = Math.round((totalCost / 2) * 100) / 100;

    // Deduct from both
    await db.query("UPDATE users SET balance = balance - ? WHERE id = ?", [callerCost, callerId]);
    await db.query("UPDATE users SET balance = balance - ? WHERE id = ?", [receiverCost, calleeId]);

    // Insert transactions
    await db.query(
        "INSERT INTO transactions (user_id, type, amount, status, description, created_at) VALUES (?, 'audio_call', ?, 'completed', ?, NOW())",
        [callerId, -callerCost, `Audio call charge (#${callLogId})`]
    );
    await db.query(
        "INSERT INTO transactions (user_id, type, amount, status, description, created_at) VALUES (?, 'audio_call', ?, 'completed', ?, NOW())",
        [calleeId, -receiverCost, `Audio call charge (#${callLogId})`]
    );

    // Update call_log with costs
    await db.query(
        "UPDATE call_logs SET cost = ?, caller_cost = ?, receiver_cost = ? WHERE id = ?",
        [totalCost, callerCost, receiverCost, callLogId]
    );

    return { totalCost, callerCost, receiverCost };
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

module.exports = { findCallByUserId, isBusy, validateRoles, checkCallPermission, checkBalance, chargeForCall, calcCost, CALL_RATE_PER_MINUTE, getFilteredCallHistory };
