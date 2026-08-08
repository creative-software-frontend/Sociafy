const db = require("../config/db");
const callService = require("../services/callService");
const platformSettingsService = require("../services/platformSettingsService");

function cleanupCall(activeCalls, callerId) {
    const call = activeCalls.get(callerId);
    if (!call) return null;
    if (call.timeoutRef) {
        clearTimeout(call.timeoutRef);
    }
    if (call.watchdogTimer) {
        clearInterval(call.watchdogTimer);
    }
    activeCalls.delete(callerId);
    return call;
}

async function endCallAndBill(io, activeCalls, userId, reason = "ended") {
    const call = callService.findCallByUserId(activeCalls, userId);
    if (!call) return;

    const { callerId, calleeId } = call;
    cleanupCall(activeCalls, callerId);

    const otherId = userId === callerId ? calleeId : callerId;

    // If a call log exists (call was connected), finalise duration + billing atomically
    if (call.callLogId && call.startedAt) {
        const endedAt = new Date();
        const durationSeconds = Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000);
        await callService.chargeForCall(call.callLogId, callerId, calleeId, durationSeconds, {
            endedAt,
            endedBy: userId,
        });
    }

    if (reason === "balance-exhausted") {
        io.to(`user_${callerId}`).emit("call:balance-exhausted", { caller_id: callerId, callee_id: calleeId });
        if (otherId !== userId) {
            io.to(`user_${otherId}`).emit("call:balance-exhausted", { caller_id: callerId, callee_id: calleeId });
        }
    }

    io.to(`user_${callerId}`).emit("call:ended", {
        caller_id: callerId,
        callee_id: calleeId,
        reason,
        ended_by: userId,
    });
    if (otherId !== userId) {
        io.to(`user_${otherId}`).emit("call:ended", {
            caller_id: callerId,
            callee_id: calleeId,
            reason,
            ended_by: userId,
        });
    }
}

/**
 * Balance watchdog: while a connected call is active, periodically check that both
 * parties still have enough balance to pay for the call. When the elapsed call
 * duration reaches the amount the lower-balance party can fund, force the call to
 * end BEFORE a negative balance can occur. chargeForCall() is the authoritative
 * safety net (it caps billing to the affordable duration regardless of this timer).
 */
function startBalanceWatchdog(io, activeCalls, call) {
    call.watchdogTimer = setInterval(async () => {
        const current = activeCalls.get(call.callerId);
        if (!current || current !== call || !call.startedAt) {
            clearInterval(call.watchdogTimer);
            call.watchdogTimer = null;
            return;
        }
        try {
            const rate = await platformSettingsService.getCallRate();
            const [cRows] = await db.query("SELECT balance FROM users WHERE id = ?", [call.callerId]);
            const [rRows] = await db.query("SELECT balance FROM users WHERE id = ?", [call.calleeId]);
            const callerBalance = Math.max(0, Number(cRows[0]?.balance) || 0);
            const receiverBalance = Math.max(0, Number(rRows[0]?.balance) || 0);

            // Seconds each party can fund: balance * 120 / rate
            const affordableSeconds = Math.min(
                callerBalance * 120 / rate,
                receiverBalance * 120 / rate
            );
            const elapsedSeconds = (Date.now() - call.startedAt.getTime()) / 1000;

            if (elapsedSeconds >= affordableSeconds) {
                clearInterval(call.watchdogTimer);
                call.watchdogTimer = null;
                await endCallAndBill(io, activeCalls, call.callerId, "balance-exhausted");
            }
        } catch (e) {
            // transient errors are ignored; chargeForCall() is the authoritative cap
        }
    }, 3000);
}

function registerCallSocket(io, socket, onlineUsers, activeCalls) {

    /* ───────── call:request ───────── */
    socket.on("call:request", async ({ receiver_id, call_type = "audio" }) => {
        const callerId = socket.userId;
        const calleeId = Number(receiver_id);
        const callerRole = socket.role;

        console.log(`[call:request] callerId=${callerId} calleeId=${calleeId} callerRole=${callerRole} same=${callerId === calleeId}`);
        console.log(`[call:request] onlineUsers has caller=${onlineUsers.has(callerId)} has callee=${onlineUsers.has(calleeId)}`);

        const [calleeRows] = await db.query("SELECT role FROM users WHERE id = ?", [calleeId]);
        if (!calleeRows.length) {
            socket.emit("call:error", { message: "User not found" });
            return;
        }
        const calleeRole = calleeRows[0].role;

        const result = await callService.checkCallPermission({
            callerId,
            calleeId,
            callerRole,
            calleeRole,
            onlineUsers,
            activeCalls,
        });

        if (!result.allowed) {
            if (result.type === "busy") {
                socket.emit("call:busy", { callee_id: calleeId });
            } else {
                socket.emit("call:error", { message: result.message });
            }
            return;
        }

        const [nameRows] = await db.query("SELECT name FROM users WHERE id = ?", [callerId]);
        const callerName = nameRows[0]?.name || "Unknown";

        const callInfo = {
            callerId,
            calleeId,
            callType: call_type,
            status: "calling",
            createdAt: Date.now(),
            timeoutRef: null,
            callLogId: null,
            startedAt: null,
            watchdogTimer: null,
        };

        activeCalls.set(callerId, callInfo);

        socket.emit("call:calling", { receiver_id: calleeId });

        console.log(`[call:request] EMITTING call:incoming to room user_${calleeId}`);
        io.to(`user_${calleeId}`).emit("call:incoming", {
            caller_id: callerId,
            caller_name: callerName,
            caller_role: callerRole,
            call_type,
        });

        callInfo.timeoutRef = setTimeout(() => {
            const call = activeCalls.get(callerId);
            if (call && call.status === "calling") {
                cleanupCall(activeCalls, callerId);
                io.to(`user_${callerId}`).emit("call:ended", {
                    caller_id: callerId,
                    callee_id: calleeId,
                    reason: "missed",
                });
                io.to(`user_${calleeId}`).emit("call:ended", {
                    caller_id: callerId,
                    callee_id: calleeId,
                    reason: "missed",
                });
            }
        }, 30000);
    });

    /* ───────── call:accept ───────── */
    socket.on("call:accept", async ({ caller_id }) => {
        const calleeId = socket.userId;
        const call = activeCalls.get(Number(caller_id));

        if (!call || call.calleeId !== calleeId) return;

        if (call.timeoutRef) {
            clearTimeout(call.timeoutRef);
            call.timeoutRef = null;
        }

        call.status = "ringing";

        io.to(`user_${call.callerId}`).emit("call:accepted", {
            callee_id: calleeId,
        });
    });

    /* ───────── call:reject ───────── */
    socket.on("call:reject", async ({ caller_id }) => {
        const calleeId = socket.userId;
        const call = activeCalls.get(Number(caller_id));
        if (!call || call.calleeId !== calleeId) return;

        cleanupCall(activeCalls, call.callerId);

        io.to(`user_${call.callerId}`).emit("call:rejected", {
            callee_id: calleeId,
        });
    });

    /* ───────── call:cancel ───────── */
    socket.on("call:cancel", async ({ receiver_id }) => {
        const callerId = socket.userId;
        const call = activeCalls.get(callerId);
        if (!call || call.calleeId !== Number(receiver_id)) return;

        cleanupCall(activeCalls, callerId);

        io.to(`user_${Number(receiver_id)}`).emit("call:cancelled", {
            caller_id: callerId,
        });
    });

    /* ───────── call:answer + create call log ───────── */
    socket.on("call:answer", async ({ caller_id, sdp }) => {
        const calleeId = socket.userId;
        const call = activeCalls.get(Number(caller_id));
        if (!call || call.calleeId !== calleeId) return;

        io.to(`user_${Number(caller_id)}`).emit("call:answer", {
            sdp,
            from: calleeId,
        });

        // Create call log entry when call is connected
        call.startedAt = new Date();
        const [result] = await db.query(
            "INSERT INTO call_logs (caller_id, callee_id, status, call_type, started_at) VALUES (?, ?, 'connected', ?, ?)",
            [call.callerId, call.calleeId, call.callType || "audio", call.startedAt]
        );
        call.callLogId = result.insertId;

        // Watch for balance exhaustion so the call is terminated before either
        // wallet can go negative.
        startBalanceWatchdog(io, activeCalls, call);
    });

    /* ───────── call:offer ───────── */
    socket.on("call:offer", async ({ receiver_id, sdp }) => {
        io.to(`user_${Number(receiver_id)}`).emit("call:offer", {
            sdp,
            from: socket.userId,
        });
    });

    /* ───────── call:ice-candidate ───────── */
    socket.on("call:ice-candidate", async ({ target_id, candidate }) => {
        io.to(`user_${Number(target_id)}`).emit("call:ice-candidate", {
            candidate,
            from: socket.userId,
        });
    });

    /* ───────── call:end ───────── */
    socket.on("call:end", async ({ target_id }) => {
        await endCallAndBill(io, activeCalls, socket.userId);
    });

    /* ───────── disconnect ───────── */
    socket.on("disconnect", async () => {
        const userId = socket.userId;
        if (userId == null) return;

        const call = callService.findCallByUserId(activeCalls, userId);
        if (!call) return;

        if (call.callLogId && call.startedAt) {
            // Call was connected — finalise with billing
            await endCallAndBill(io, activeCalls, userId);
        } else {
            // Call never connected — just clean up
            cleanupCall(activeCalls, call.callerId);
            const otherId = userId === call.callerId ? call.calleeId : call.callerId;
            io.to(`user_${otherId}`).emit("call:ended", {
                caller_id: call.callerId,
                callee_id: call.calleeId,
                reason: "disconnect",
                ended_by: userId,
            });
        }
    });
}

module.exports = { registerCallSocket };
