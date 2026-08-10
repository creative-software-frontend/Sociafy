const express = require("express");
const router = express.Router();
const adminAuthController = require("../controllers/adminAuthController");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const {
    adminAuthLoginLimiter,
    adminPasswordChangeLimiter,
    adminAccountDeleteLimiter,
    adminSetupLimiter,
} = require("../config/rateLimits");

// Public first-admin setup. IP-rate-limited; locked by the live admin count.
router.get("/setup-status", adminAuthController.setupStatus);
router.post("/setup", adminSetupLimiter, adminAuthController.setup);

// Public admin login is IP-rate-limited to prevent brute force / abuse.
router.post("/login", adminAuthLoginLimiter, adminAuthController.login);

// The following endpoints require a valid admin token.
router.get("/me", adminAuthMiddleware, adminAuthController.me);
router.post("/change-password", adminAuthMiddleware, adminPasswordChangeLimiter, adminAuthController.changePassword);
router.delete("/account", adminAuthMiddleware, adminAccountDeleteLimiter, adminAuthController.deleteAccount);
router.post("/logout", adminAuthMiddleware, adminAuthController.logout);

module.exports = router;
