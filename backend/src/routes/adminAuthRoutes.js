const express = require("express");
const router = express.Router();
const adminAuthController = require("../controllers/adminAuthController");
const adminAuthMiddleware = require("../middleware/adminAuthMiddleware");
const { adminAuthLoginLimiter, adminPasswordChangeLimiter } = require("../config/rateLimits");

// Public admin login is IP-rate-limited to prevent brute force / abuse.
router.post("/login", adminAuthLoginLimiter, adminAuthController.login);

// The following endpoints require a valid admin token.
router.get("/me", adminAuthMiddleware, adminAuthController.me);
router.post("/change-password", adminAuthMiddleware, adminPasswordChangeLimiter, adminAuthController.changePassword);
router.post("/logout", adminAuthMiddleware, adminAuthController.logout);

module.exports = router;
