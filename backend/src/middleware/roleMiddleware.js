const db = require("../config/db");

const roleMiddleware = (roles) => {
    return (req, res, next) => {
        const userId = req.user.id;

        db.query(
            "SELECT role, is_active FROM users WHERE id = ?",
            [userId],
            (err, result) => {
                if (err) {
                    return res.status(500).json({ message: "DB error" });
                }

                if (result.length === 0) {
                    return res.status(404).json({ message: "User not found" });
                }

                const user = result[0];

                // Inactive accounts are never authorized on role-protected routes.
                if (Number(user.is_active) !== 1) {
                    return res.status(403).json({ message: "Your account is blocked by the administrator." });
                }

                if (!roles.includes(user.role)) {
                    return res.status(403).json({
                        message: "Access denied"
                    });
                }

                next();
            }
        );
    };
};

module.exports = roleMiddleware;