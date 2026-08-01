const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { getWallet, getTransactions, withdraw } = require("../controllers/adminWalletController");

router.get("/", authMiddleware, roleMiddleware(["admin"]), getWallet);
router.get("/transactions", authMiddleware, roleMiddleware(["admin"]), getTransactions);
router.post("/withdraw", authMiddleware, roleMiddleware(["admin"]), withdraw);

module.exports = router;
