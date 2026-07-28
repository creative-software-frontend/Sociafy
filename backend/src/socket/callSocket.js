const db = require("../config/db");
const callService = require("../services/callService");

function cleanupCall(activeCalls, callerId) {
    const call = activeCalls.get(callerId);
    if (!call) return null;
    if (call.timeoutRef) {
        clearTimeout(call.timeoutRef);
    }
    activeCalls.delete(callerId);
    return call;
}

async function endCallAndBill(io, activeCalls, userId) {
    const call = callService.findCallByUserId(activeCalls, userId);
    if (!call) return;

    const { callerId, calleeId } = call;
    cleanupCall(activeCalls, callerId);

    const otherId = userId === callerId ? calleeId : callerId;

    // If a call log exists (call was connected), finalise duration + billing
    if (call.callLogId && call.startedAt) {
        const endedAt = new Date();
        const durationSeconds = Math.floor((endedAt.getTime() - call.startedAt.getTime()) / 1000);
        await db.query(
            "UPDATE call_logs SET ended_at = ?, duration_seconds = ?, ended_by = ? WHERE id = ?",
            [endedAt, durationSeconds, userId, call.callLogId]
        );
        // Charge both users
        await callService.chargeForCall(call.callLogId, callerId, calleeId, durationSeconds);
    }

    io.to(`user_${callerId}`).emit("call:ended", {
        caller_id: callerId,
        callee_id: calleeId,
        reason: "ended",
        ended_by: userId,
    });
    if (otherId !== userId) {
        io.to(`user_${otherId}`).emit("call:ended", {
            caller_id: callerId,
            callee_id: calleeId,
            reason: "ended",
            ended_by: userId,
        });
    }
}

function registerCallSocket(io, socket, onlineUsers, activeCalls) {

    /* ───────── call:request ───────── */
    socket.on("call:request", async ({ receiver_id, call_type = "audio" }) => {
        const callerId = socket.userId;
        const calleeId = Number(receiver_id);
        const callerRole = socket.role;

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
        };

        activeCalls.set(callerId, callInfo);

        socket.emit("call:calling", { receiver_id: calleeId });

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
