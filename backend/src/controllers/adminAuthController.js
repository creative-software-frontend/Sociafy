const db = require("../config/db");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");

const ADMIN_PASSWORD_MIN_LENGTH = 16;
const BCRYPT_ROUNDS = 10;

/**
 * POST /api/admin/auth/login
 * Dedicated admin login. Rejects normal users, inactive accounts,
 * nonexistent accounts and incorrect passwords.
 */
exports.login = async (req, res) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ message: "All fields required" });
    }

    try {
        const [rows] = await db.query(
            "SELECT id, name, email, phone, password, role, is_active, token_version FROM users WHERE email = ? LIMIT 1",
            [email]
        );
        const user = rows && rows[0];

        // Nonexistent account — generic response, no account enumeration.
        if (!user) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Verify the password BEFORE revealing role/active state, so failed
        // login attempts cannot be used to enumerate account types.
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Non-admin (normal user or provider) must never log in as admin.
        if (user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }

        // Inactive admin account.
        if (Number(user.is_active) !== 1) {
            return res.status(403).json({ message: "Your account is blocked by the administrator." });
        }

        const token = generateToken(user.id, "admin", user.token_version);

        return res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: "admin",
            token,
        });
    } catch (err) {
        console.error("[admin auth] login failed:", err && err.message);
        return res.status(500).json({ message: "An internal server error occurred." });
    }
};

/**
 * GET /api/admin/auth/me
 * Requires a valid admin token. Returns the authenticated admin (no secrets).
 */
exports.me = (req, res) => {
    return res.json({
        id: req.user.id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
    });
};

/**
 * POST /api/admin/auth/change-password
 * Requires a valid admin token. Verifies the current password, enforces a
 * strong new password, hashes it with the existing bcrypt system and updates
 * only the authenticated admin's password.
 */
exports.changePassword = async (req, res) => {
    const adminId = req.user.id;
    const { currentPassword, newPassword } = req.body || {};

    if (!currentPassword || !newPassword) {
        return res.status(400).json({
            success: false,
            message: "Current password and new password are required.",
        });
    }

    if (typeof newPassword !== "string" || newPassword.length < ADMIN_PASSWORD_MIN_LENGTH) {
        return res.status(400).json({
            success: false,
            message: `New password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`,
        });
    }

    if (newPassword === currentPassword) {
        return res.status(400).json({
            success: false,
            message: "New password must be different from your current password.",
        });
    }

    try {
        const [rows] = await db.query(
            "SELECT password FROM users WHERE id = ? LIMIT 1",
            [adminId]
        );
        const user = rows && rows[0];
        if (!user) {
            return res.status(404).json({ success: false, message: "Admin not found" });
        }

        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) {
            return res.status(400).json({
                success: false,
                message: "Current password is incorrect.",
            });
        }

        const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

        // Increment token_version to invalidate every previously issued admin
        // JWT for this account. adminAuthMiddleware rejects the stale version
        // on subsequent requests, so the admin must sign in again.
        await db.query(
            "UPDATE users SET password = ?, token_version = token_version + 1 WHERE id = ?",
            [hashedPassword, adminId]
        );

        return res.json({
            success: true,
            message: "Password changed successfully. Please sign in again.",
        });
    } catch (err) {
        console.error("[admin auth] change-password failed:", err && err.message);
        return res.status(500).json({ success: false, message: "An internal server error occurred." });
    }
};

/**
 * POST /api/admin/auth/logout
 * Optional endpoint. The current architecture uses stateless JWTs with no
 * server-side blacklist, so logout simply acknowledges the client-side
 * token discard. No sensitive information is returned.
 */
exports.logout = (req, res) => {
    return res.json({ success: true, message: "Logged out successfully." });
};
