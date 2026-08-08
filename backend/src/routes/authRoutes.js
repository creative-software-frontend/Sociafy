const express = require("express");
const router = express.Router();
const { register, login } = require("../controllers/authController");
const { authLoginLimiter, authRegisterLimiter } = require("../config/rateLimits");

// Public auth endpoints are IP-rate-limited to prevent brute force / abuse.
router.post("/register", authRegisterLimiter, register);
router.post("/login", authLoginLimiter, login);

module.exports = router;
