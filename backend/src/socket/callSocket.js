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

function registerCallSocket(io, socket, onlineUsers, activeCalls) {

    /* ───────── call:request ───────── */
    socket.on("call:request", async ({ receiver_id, call_type = "audio" }) => {
        const callerId = socket.userId;
        const calleeId = Number(receiver_id);
        const callerRole = socket.role;

        // Fetch callee role
        const [calleeRows] = await db.query("SELECT role FROM users WHERE id = ?", [calleeId]);
        if (!calleeRows.length) {
            socket.emit("call:error", { message: "User not found" });
            return;
        }
        const calleeRole = calleeRows[0].role;

        // Validate
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

        // Get caller name for the incoming notification
        const [nameRows] = await db.query("SELECT name FROM users WHERE id = ?", [callerId]);
        const callerName = nameRows[0]?.name || "Unknown";

        // Create active call entry
        const callInfo = {
            callerId,
            calleeId,
            callType: call_type,
            status: "calling",
            createdAt: Date.now(),
            timeoutRef: null,
        };

        activeCalls.set(callerId, callInfo);

        // Caller receives acknowledgement
        socket.emit("call:calling", { receiver_id: calleeId });

        // Notify callee
        io.to(`user_${calleeId}`).emit("call:incoming", {
            caller_id: callerId,
            caller_name: callerName,
            caller_role: callerRole,
            call_type,
        });

        // 30-second timeout — if callee doesn't accept, cancel automatically
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

        // Notify caller that callee accepted
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

    /* ───────── call:end ───────── */
    socket.on("call:end", async ({ target_id }) => {
        const userId = socket.userId;
        const call = callService.findCallByUserId(activeCalls, userId);
        if (!call) return;

        cleanupCall(activeCalls, call.callerId);

        const otherId = userId === call.callerId ? call.calleeId : call.callerId;
        io.to(`user_${call.callerId}`).emit("call:ended", {
            caller_id: call.callerId,
            callee_id: call.calleeId,
            reason: "ended",
            ended_by: userId,
        });
        if (otherId !== userId) {
            io.to(`user_${otherId}`).emit("call:ended", {
                caller_id: call.callerId,
                callee_id: call.calleeId,
                reason: "ended",
                ended_by: userId,
            });
        }
    });

    /* ───────── call:offer ───────── */
    socket.on("call:offer", async ({ receiver_id, sdp }) => {
        io.to(`user_${Number(receiver_id)}`).emit("call:offer", {
            sdp,
            from: socket.userId,
        });
    });

    /* ───────── call:answer ───────── */
    socket.on("call:answer", async ({ caller_id, sdp }) => {
        io.to(`user_${Number(caller_id)}`).emit("call:answer", {
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

    /* ───────── disconnect ───────── */
    socket.on("disconnect", () => {
        const userId = socket.userId;
        if (userId == null) return;

        const call = callService.findCallByUserId(activeCalls, userId);
        if (!call) return;

        cleanupCall(activeCalls, call.callerId);

        const otherId = userId === call.callerId ? call.calleeId : call.callerId;
        io.to(`user_${otherId}`).emit("call:ended", {
            caller_id: call.callerId,
            callee_id: call.calleeId,
            reason: "disconnect",
            ended_by: userId,
        });
    });
}

module.exports = { registerCallSocket };
