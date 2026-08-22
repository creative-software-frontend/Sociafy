const jwt = require("jsonwebtoken");
const db = require("../config/db");

const authMiddleware = async (req, res, next) => {
    try {
        let token;

        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return res.status(401).json({
                message: "No token provided"
            });
        }

        token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const [rows] = await db.query(
            "SELECT role, is_active FROM users WHERE id = ?",
            [decoded.id]
        );
        const user = rows && rows[0];
        if (!user) return res.status(404).json({ message: "User not found" });
        if (Number(user.is_active) !== 1) {
            return res.status(403).json({ message: "Your account is blocked by the administrator." });
        }
        req.user = { ...decoded, role: user.role };

        // ── Presence: update last_seen/is_online on every authenticated request ──
        if (req.user && req.user.id) {
            db.query(
                "UPDATE users SET last_seen = NOW(), is_online = 1 WHERE id = ?",
                [req.user.id],
                (err) => {
                    if (err) console.error("Failed to update presence:", err.message);
                }
            );
        }

        // membership expiry fallback (FREE when expired)
        const { membershipExpiryMiddleware } = require('./membershipMiddleware');
        return membershipExpiryMiddleware(req, res, next);

    } catch (error) {
        return res.status(401).json({
            message: "Token invalid or expired"
        });
    }
};

module.exports = authMiddleware;
