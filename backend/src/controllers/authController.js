const db = require("../config/db");
const bcrypt = require("bcrypt");
const generateToken = require("../utils/generateToken");
const { generateReferralLink } = require("../utils/referralLink");

// Valid Bangladesh mobile number: +880 followed by exactly 10 digits,
// first digit 1, second digit one of 3,4,5,6,7,8,9.
const BD_MOBILE_REGEX = /^8801[3-9]\d{8}$/;

exports.register = async (req, res) => {
    const { name, email, phone, password, role, privacyAccepted } = req.body || {};

    // ✅ Task 3: Check Privacy Policy acceptance
    if (!privacyAccepted) {
        return res.status(400).json({ 
            message: "You must accept the Privacy Policy to continue" 
        });
    }

    if (!name || !email || !phone || !password) {
        return res.status(400).json({ message: "All fields required" });
    }

    // Enforce a reasonable minimum password length.
    if (typeof password !== "string" || password.length < 6) {
        return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    // ✅ Validate Bangladesh mobile number (digits only, +880 prefix enforced)
    const normalizedPhone = String(phone).replace(/\D/g, "");
    const bdPhone = normalizedPhone.startsWith("880")
        ? normalizedPhone
        : `880${normalizedPhone.replace(/^0/, "")}`;
    if (!BD_MOBILE_REGEX.test(bdPhone)) {
        return res.status(400).json({ message: "Please enter a valid Bangladesh mobile number." });
    }

    const allowedRoles = ["user", "provider"];
    const assignedRole = allowedRoles.includes(role) ? role : "user";

    db.query("SELECT email FROM users WHERE email = ?", [email], async (err, result) => {
        if (err) return res.status(500).json({ message: "An internal server error occurred." });
        if (result.length > 0) {
            return res.status(400).json({ message: "User already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        db.query(
            "INSERT INTO users (name, email, phone, password, role, privacy_accepted, privacy_accepted_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
            [name, email, phone, hashedPassword, assignedRole, 1],
            (err, result) => {
                if (err) return res.status(500).json({ message: "An internal server error occurred." });

                const userId = result.insertId;
                
                // ✅ Task 2: Generate referral link based on role
                const referral = generateReferralLink(userId, assignedRole);
                const token = generateToken(userId, assignedRole);

                res.status(201).json({
                    id: userId,
                    name,
                    email,
                    phone,
                    role: assignedRole,
                    referralLink: referral.url,
                    referralCode: referral.code,
                    token
                });
            }
        );
    });
};

exports.login = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: "All fields required" });
    }

    db.query("SELECT * FROM users WHERE email = ?", [email], async (err, result) => {
        if (err) return res.status(500).json({ message: "An internal server error occurred." });
        if (result.length === 0) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        const user = result[0];
        if (user.is_active === 0) {
            return res.status(403).json({ message: "Your account is blocked by the administrator." });
        }

        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(400).json({ message: "Invalid credentials" });
        }

        // Admins must use the dedicated admin portal (POST /api/admin/auth/login).
        if (user.role === "admin") {
            return res.status(403).json({ message: "Please use the admin login portal." });
        }

        // ✅ Task 2: Generate referral link on login too
        const referral = generateReferralLink(user.id, user.role);
        const token = generateToken(user.id, user.role);

        res.json({
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            referralLink: referral.url,
            referralCode: referral.code,
            token
        });
    });
};

// POST /api/user/change-password
// Requires JWT (authMiddleware). Reuses the same bcrypt rounds (10) as registration.
exports.changePassword = (req, res) => {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body || {};

    // ── Validation ──
    if (!currentPassword || !newPassword || !confirmPassword) {
        return res.status(400).json({
            success: false,
            message: "Current password, new password, and confirmation are all required."
        });
    }

    if (newPassword !== confirmPassword) {
        return res.status(400).json({
            success: false,
            message: "New password and confirmation do not match."
        });
    }

    // Reasonable minimum password length (consistent with registration).
    if (newPassword.length < 6) {
        return res.status(400).json({
            success: false,
            message: "Password must be at least 6 characters."
        });
    }

    db.query(
        "SELECT password FROM users WHERE id = ?",
        [userId],
        async (err, result) => {
            if (err) return res.status(500).json({ success: false, message: "An internal server error occurred." });
            if (!result || result.length === 0) {
                return res.status(404).json({ success: false, message: "User not found" });
            }

            const user = result[0];

            // Verify the supplied current password.
            const match = await bcrypt.compare(currentPassword, user.password);
            if (!match) {
                return res.status(400).json({
                    success: false,
                    message: "Current password is incorrect."
                });
            }

            // New password must differ from the current one.
            if (currentPassword === newPassword) {
                return res.status(400).json({
                    success: false,
                    message: "New password must be different from your current password."
                });
            }

            // Hash with the same rounds used at registration (10).
            const hashedPassword = await bcrypt.hash(newPassword, 10);

            db.query(
                "UPDATE users SET password = ? WHERE id = ?",
                [hashedPassword, userId],
                (err) => {
                    if (err) return res.status(500).json({ success: false, message: "An internal server error occurred." });
                    return res.json({
                        success: true,
                        message: "Password changed successfully."
                    });
                }
            );
        }
    );
};