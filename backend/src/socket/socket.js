const { Server } = require("socket.io");
const { verifySocketJwt } = require("./socketAuth");
const { registerChatSocket } = require("./chatSocket");
const { registerCallSocket } = require("./callSocket");

function setupSocket(httpServer) {
    const io = new Server(httpServer, {
        cors: {
            origin: [
                "http://localhost:5173",
                "http://localhost:5174",
                "http://localhost:5175",
                "http://localhost:5176"
            ],
            credentials: true
        }
    });

    // userId -> socketId (online users)
    const onlineUsers = new Map();
    // callerId -> { callerId, calleeId, status, startedAt, timeoutRef }
    const activeCalls = new Map();

    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.split(" ")[1];
            if (!token) {
                return next(new Error("Unauthorized"));
            }
            const { userId, role } = await verifySocketJwt(token);
            socket.userId = userId;
            socket.role = role;
            return next();
        } catch (err) {
            return next(err);
        }
    });

    io.on("connection", (socket) => {
        if (socket.userId != null) {
            // Join personal room so we can emit to user_${id} from anywhere
            socket.join(`user_${socket.userId}`);
            onlineUsers.set(socket.userId, socket.id);
        }

        registerChatSocket(io, socket, onlineUsers);
        registerCallSocket(io, socket, onlineUsers, activeCalls);

        socket.on("disconnect", () => {
            if (socket.userId != null && onlineUsers.get(socket.userId) === socket.id) {
                onlineUsers.delete(socket.userId);
            }
        });
    });

    return io;
}

module.exports = {
    setupSocket
};

