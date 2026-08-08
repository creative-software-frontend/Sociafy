const { getMessages, sendMessage, checkChatPermission } = require("../services/chatService");
const { createSocketLimiter } = require("../config/rateLimits");

// Per-user message spam protection (windowed, in-memory).
const chatMessageLimiter = createSocketLimiter({ windowMs: 60000, max: 30, scope: "chat:message" });

function registerChatSocket(io, socket, onlineUsers) {
    // Note: Only implement the events required by the task.

    // Shared gate: membership (existing) + partner-request rule for user↔provider.
    const canChat = async (receiver_id) => {
        try {
            const { checkFeatureAccess } = require("../middleware/membershipMiddleware");
            const allowed = (await checkFeatureAccess(socket.userId, "CHAT", socket.role)).allowed;
            if (!allowed) {
                socket.emit("error", { error: true, message: "Upgrade to Silver to use chat." });
                console.log("[SOCKET CHAT BLOCKED] membership");
                return false;
            }

            const perm = await checkChatPermission(socket.userId, receiver_id);
            if (!perm.allowed) {
                socket.emit("error", { error: true, message: perm.message || "Chat is locked until the partner request is accepted." });
                console.log("[SOCKET CHAT BLOCKED] partner-request");
                return false;
            }
            return true;
        } catch {
            socket.emit("error", { error: true, message: "Membership check failed" });
            return false;
        }
    };

    socket.on("typing", async ({ receiver_id }) => {
        if (!receiver_id) return;
        if (!(await canChat(receiver_id))) return;

        io.to(`user_${Number(receiver_id)}`).emit("typing", { sender_id: socket.userId });
    });


    socket.on("stopTyping", async ({ receiver_id }) => {
        if (!receiver_id) return;
        if (!(await canChat(receiver_id))) return;

        io.to(`user_${Number(receiver_id)}`).emit("stopTyping", { sender_id: socket.userId });
    });


    socket.on("sendMessage", async ({ receiver_id, message }) => {
        try {
            const rl = chatMessageLimiter(socket.userId);
            if (!rl.allowed) {
                socket.emit("error", { error: true, message: "Too many requests. Please try again later." });
                return;
            }

            if (!(await canChat(receiver_id))) return;

            const senderId = socket.userId;
            const payload = await sendMessage({
                senderId,
                receiverId: receiver_id,
                message
            });


            // Emit to both sender and receiver rooms (room-per-user architecture).
            // This guarantees delivery even with multiple tabs / devices,
            // and lets the sender's own sidebar update in real time.
            const msgPayload = {
                ...payload,
                created_at: payload.created_at ?? new Date().toISOString(),
            };
            io.to(`user_${senderId}`).emit("newMessage", msgPayload);
            io.to(`user_${Number(receiver_id)}`).emit("newMessage", msgPayload);

            // Optionally confirm to sender? Task does not list an event for this, so we do not.
        } catch (err) {
            socket.emit("error", { message: err.message || "Message send failed" });
        }
    });

    socket.on("markAsRead", async () => {
        // Not implemented because schema changes are disallowed.
        // Kept to avoid inventing new REST/storage behavior.
    });

    socket.on("connection", () => {
        // no-op; connection is handled by socket.js
    });

    socket.on("disconnect", () => {
        // no-op; disconnect is handled by socket.js
    });
}

module.exports = {
    registerChatSocket
};

