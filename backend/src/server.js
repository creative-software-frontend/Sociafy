const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
require("dotenv").config();

// Fail fast if required production variables are missing/invalid.
const envConfig = require("./config/envConfig");
try {
    envConfig.validateEnv();
} catch (err) {
    console.error("[config] " + err.message);
    process.exit(1);
}

const app = express();
const db = require("./config/db");

// Reverse-proxy awareness for rate limiting (IP extraction). Only enabled when
// TRUST_PROXY is explicitly set. Accepts: true, a hop count (e.g. 1), or
// comma-separated addresses. Not enabled blindly.
const trustProxy = process.env.TRUST_PROXY;
if (trustProxy !== undefined && trustProxy !== "") {
    if (trustProxy === "true") app.set("trust proxy", true);
    else if (/^\d+$/.test(trustProxy)) app.set("trust proxy", Number(trustProxy));
    else app.set("trust proxy", trustProxy.split(",").map((s) => s.trim()));
}

const corsOrigins = envConfig.getCorsOrigins();
// Security headers. CSP is intentionally left off so WebRTC, external fonts,
// Socket.IO and uploads keep working; Helmet still adds HSTS, nosniff, frame
// protections, etc.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
    origin(origin, cb) {
        // Allow same-origin / non-browser requests (curl, server-to-server) and
        // any explicitly configured origin. Never `*` (credentials are enabled).
        if (!origin || corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
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

app.use("/api/admin/auth", require("./routes/adminAuthRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/admin", require("./routes/adminReportRoutes"));
app.use("/api/admin/wallet", require("./routes/adminWalletRoutes"));
app.use("/api/admin-wallet", require("./routes/admin.wallet.routes"));

app.use("/api/upload", require("./routes/uploadRoutes"));

app.use("/api/newsfeed", require("./routes/newsfeedRoutes"));

app.use("/api/call", require("./routes/callRoutes"));
app.use("/api/gift", require("./routes/giftRoutes").userRouter);
app.use("/api/admin/gifts", require("./routes/giftRoutes").adminRouter);

app.use("/api/deposit-methods", require("./routes/paymentMethodRoutes").userRouter);
app.use("/api/admin/deposit-methods", require("./routes/paymentMethodRoutes").adminRouter);
app.use("/api", require("./routes/reportRoutes"));


// 404
app.use((req, res) => {
    res.status(404).json({ message: "Route not found" });
});

// Global error handler: log details server-side, return a generic message to
// the client for 5xx. Preserves intentional 4xx error messages.
app.use((err, req, res, next) => {
    const status = err && err.statusCode ? Number(err.statusCode) : 500;
    console.error("[server error]", status, err && err.message);
    if (status >= 500) {
        return res.status(500).json({ message: "An internal server error occurred." });
    }
    return res.status(status).json({ message: (err && err.message) || "An internal server error occurred." });
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
