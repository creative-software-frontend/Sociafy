const giftService = require("../services/giftService");

function registerGiftSocket(io, socket) {
    socket.on("gift:send", async ({ receiver_id, gift_id }) => {
        try {
            const receiverId = Number(receiver_id);
            const giftId = Number(gift_id);
            if (!receiverId || !giftId) {
                socket.emit("gift:error", { message: "Invalid payload" });
                return;
            }

            const result = await giftService.sendGift({
                senderId: socket.userId,
                receiverId,
                giftId,
            });

            const payload = {
                ...result,
                created_at: result.created_at ?? new Date().toISOString(),
            };

            // Reuse existing chat message infra — both sides see the gift instantly
            io.to(`user_${result.sender_id}`).emit("newMessage", payload);
            io.to(`user_${result.receiver_id}`).emit("newMessage", payload);

            socket.emit("gift:sent", { message: "Gift sent" });
        } catch (err) {
            socket.emit("gift:error", { message: err.message || "Failed to send gift" });
        }
    });
}

module.exports = { registerGiftSocket };