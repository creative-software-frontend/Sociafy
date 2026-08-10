const db = require("../config/db");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");

const ADMIN_PASSWORD_MIN_LENGTH = 16;
const BCRYPT_ROUNDS = 10;

/**
 * GET /api/admin/auth/setup-status
 * Public. Setup availability is driven entirely by the live admin account
 * count: exactly zero or one admin may exist. Returns `setup_available: true`
 * when no admin account exists. Never reveals any secrets.
 */
exports.setupStatus = async (req, res) => {
    try {
        const [rows] = await db.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        const setup_available = !(rows && rows.length > 0);
        return res.json({ setup_available });
    } catch (err) {
        console.error("[admin auth] setup-status failed:", err && err.message);
        return res.status(500).json({ message: "An internal server error occurred." });
    }
};

/**
 * POST /api/admin/auth/setup
 * Public. Creates the FIRST administrator account.
 *
 * Business rule: exactly zero or one admin account may exist at any time.
 * Setup is gated by the live existence of an admin row — not by any flag.
 * If the last admin is deleted, setup becomes available again with no manual
 * SQL reset.
 *
 * Race safety: the check + INSERT run inside a single transaction that first
 * takes a row lock on the single platform_settings row (id = 1). Concurrent
 * setup requests therefore serialize on that lock, so two simultaneous
 * requests can never create two admins.
 *
 * - Rejects when any admin row already exists (authoritative state).
 * - Does NOT touch normal-user registration and is not exposed via /register.
 */
exports.setup = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body || {};

    if (!name || !email || !password || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: "All fields are required.",
        });
    }

    if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Please enter your name." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({ success: false, message: "Please enter a valid email address." });
    }

    if (typeof password !== "string" || password.length < ADMIN_PASSWORD_MIN_LENGTH) {
        return res.status(400).json({
            success: false,
            message: `Password must be at least ${ADMIN_PASSWORD_MIN_LENGTH} characters.`,
        });
    }

    if (password !== confirmPassword) {
        return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

    // Hash before taking the transaction lock to keep the lock hold-time short.
    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    let connection;
    let aborted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Serialize all concurrent setup attempts on the single settings row.
        // The row must exist (created/seeded by migrations + initTables).
        await connection.query("SELECT id FROM platform_settings WHERE id = 1 FOR UPDATE");

        // Authoritative check: an existing admin means setup is unavailable.
        const [adminRows] = await connection.query(
            "SELECT id FROM users WHERE role = 'admin' LIMIT 1"
        );
        if (adminRows && adminRows.length > 0) {
            aborted = true;
            await connection.rollback();
            return res.status(403).json({
                success: false,
                message: "An administrator account already exists. Please use the admin login portal.",
            });
        }

        // Existing email collision (across all roles) — enumeration-safe: the
        // response does not distinguish between a taken admin email and a
        // taken user email, and only fires for emails the caller supplied.
        const [existing] = await connection.query(
            "SELECT id FROM users WHERE email = ? LIMIT 1",
            [normalizedEmail]
        );
        if (existing && existing.length > 0) {
            aborted = true;
            await connection.rollback();
            return res.status(409).json({ success: false, message: "An account with this email already exists." });
        }

        const [result] = await connection.query(
            "INSERT INTO users (name, email, phone, password, role, is_active, token_version) VALUES (?, ?, ?, ?, 'admin', 1, 0)",
            [name.trim(), normalizedEmail, "00000000000", hashedPassword]
        );

        await connection.commit();
        return res.status(201).json({
            success: true,
            message: "Administrator account created successfully. You can now sign in.",
            id: result.insertId,
        });
    } catch (err) {
        if (connection && !aborted) {
            try { await connection.rollback(); } catch (_) { /* already rolled back */ }
        }
        console.error("[admin auth] setup failed:", err && err.message);
        return res.status(500).json({ success: false, message: "An internal server error occurred." });
    } finally {
        if (connection) connection.release();
    }
};

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
 * DELETE /api/admin/auth/account
 * Requires a valid admin token (adminAuthMiddleware already enforced role,
 * is_active, and token_version against the DB). Deletes the authenticated
 * admin's OWN account after re-verifying the current password.
 *
 * - Runs in a transaction so a concurrent password change / state change can
 *   never leave a partially deleted account.
 * - Increments token_version before deletion so any in-flight JWT for this
 *   account is invalidated even if the row were to linger in a cache.
 * - Id-scoped AND role-guarded delete: normal users can never be removed.
 * - Generic auth errors — no sensitive account information is leaked.
 */
exports.deleteAccount = async (req, res) => {
    const adminId = req.user.id;
    const { password } = req.body || {};

    if (typeof password !== "string" || !password) {
        return res.status(400).json({ success: false, message: "Current password is required." });
    }

    let connection;
    let aborted = false;
    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // Re-read the admin row by the authenticated ID inside the transaction.
        const [rows] = await connection.query(
            "SELECT id, password, role, is_active FROM users WHERE id = ? LIMIT 1",
            [adminId]
        );
        const user = rows && rows[0];

        if (!user) {
            aborted = true;
            await connection.rollback();
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }
        if (Number(user.is_active) !== 1) {
            aborted = true;
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Your account is blocked by the administrator." });
        }
        if (user.role !== "admin") {
            aborted = true;
            await connection.rollback();
            return res.status(403).json({ success: false, message: "Admin access required" });
        }

        // Current-password verification (bcrypt). Generic error, no enumeration.
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            aborted = true;
            await connection.rollback();
            return res.status(401).json({ success: false, message: "Invalid credentials." });
        }

        // Invalidate any in-flight JWT for this account before removal.
        await connection.query(
            "UPDATE users SET token_version = token_version + 1 WHERE id = ?",
            [adminId]
        );

        // Delete ONLY this admin row (id-scoped and role-guarded).
        const [result] = await connection.query(
            "DELETE FROM users WHERE id = ? AND role = 'admin'",
            [adminId]
        );
        if (!result || result.affectedRows !== 1) {
            aborted = true;
            await connection.rollback();
            return res.status(409).json({
                success: false,
                message: "Unable to delete the administrator account. Please try again.",
            });
        }

        await connection.commit();
        return res.json({
            success: true,
            message: "Administrator account deleted. You can create a new administrator account.",
        });
    } catch (err) {
        if (connection && !aborted) {
            try { await connection.rollback(); } catch (_) { /* already rolled back */ }
        }
        console.error("[admin auth] delete-account failed:", err && err.message);
        return res.status(500).json({ success: false, message: "An internal server error occurred." });
    } finally {
        if (connection) connection.release();
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
