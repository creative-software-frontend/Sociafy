const db = require("../config/db");
const { getPartnerRequestStatus } = require("../services/chatService");
const { checkFeatureAccess } = require("../middleware/membershipMiddleware");

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

        return { allowed: true };
    } catch (err) {
        return { allowed: false, message: err.message || "Call permission check failed" };
    }
}

module.exports = { findCallByUserId, isBusy, validateRoles, checkCallPermission };
