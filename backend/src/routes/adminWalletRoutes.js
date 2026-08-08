const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getWallet, getTransactions, withdraw } = require("../controllers/adminWalletController");
const { adminWalletLimiter } = require("../config/rateLimits");

router.get("/", authMiddleware, roleMiddleware(["admin"]), getWallet);
router.get("/transactions", authMiddleware, roleMiddleware(["admin"]), getTransactions);
router.post("/withdraw", authMiddleware, roleMiddleware(["admin"]), adminWalletLimiter, withdraw);

module.exports = router;
