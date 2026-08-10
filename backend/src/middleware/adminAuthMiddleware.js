const jwt = require("jsonwebtoken");
const db = require("../config/db");

/**
 * Dedicated admin authentication middleware.
 *
 * Protected admin endpoints must require:
 *   1. a valid JWT
 *   2. an existing user (valid user)
 *   3. an active account (is_active = 1)
 *   4. role = 'admin'
 *   5. a non-stale auth-session version (token_version)
 *
 * A normal user's (or provider's) token is never accepted here, regardless of
 * any role claim present in the token — the role, active flag and token version
 * are re-read from the database on every request so a stale/deactivated account
 * is blocked and tokens issued before a password change are rejected.
 */
const adminAuthMiddleware = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer")) {
            return res.status(401).json({ message: "No token provided" });
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (!decoded || !decoded.id) {
            return res.status(401).json({ message: "Token invalid or expired" });
        }

        const [rows] = await db.query(
            "SELECT id, name, email, role, is_active, token_version FROM users WHERE id = ? LIMIT 1",
            [decoded.id]
        );

        const user = rows && rows[0];
        if (!user) {
            return res.status(401).json({ message: "Unauthorized" });
        }
        if (Number(user.is_active) !== 1) {
            return res.status(403).json({ message: "Your account is blocked by the administrator." });
        }
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }
        // Reject stale sessions. A JWT whose embedded token_version no longer
        // matches the current DB value (e.g. after a password change) is
        // rejected, invalidating all previously issued admin JWTs.
        if (Number(decoded.token_version) !== Number(user.token_version)) {
            return res.status(401).json({ message: "Session expired. Please sign in again." });
        }

        req.user = { id: user.id, name: user.name, email: user.email, role: "admin" };
        return next();
    } catch (error) {
        return res.status(401).json({ message: "Token invalid or expired" });
    }
};

module.exports = adminAuthMiddleware;
