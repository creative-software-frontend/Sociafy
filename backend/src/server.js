const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const db = require("./config/db");

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:5176",
    ],
    credentials: true
}));

app.use(express.json());

// Static uploads
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
    res.send("Backend is running");
});

// routes
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/test", require("./routes/testRoutes"));

app.use("/api/user", require("./routes/userRoutes"));
app.use("/api/user/membership", require("./routes/membershipRoutes"));

app.use("/api/user-wallet", require("./routes/wallet.routes"));

app.use("/api/provider", require("./routes/providerRoutes"));

app.use("/api/partner", require("./routes/partnerRequestRoutes"));
app.use("/api/provider", require("./routes/partnerRequestRoutes"));

app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/admin/wallet", require("./routes/adminWalletRoutes"));
app.use("/api/admin-wallet", require("./routes/admin.wallet.routes"));

app.use("/api/upload", require("./routes/uploadRoutes"));

app.use("/api/newsfeed", require("./routes/newsfeedRoutes"));

app.use("/api/call", require("./routes/callRoutes"));
app.use("/api/gift", require("./routes/giftRoutes").userRouter);
app.use("/api/admin/gifts", require("./routes/giftRoutes").adminRouter);


// 404
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

const PORT = process.env.PORT || 5000;

const httpServer = require("http").createServer(app);

const { setupSocket } = require("./socket/socket");
setupSocket(httpServer);

httpServer.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);

    // optional: safe startup init
    await require("./startup/initTables")(db);
});
