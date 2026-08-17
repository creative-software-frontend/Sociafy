const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const walletController = require("../controllers/walletController");

router.get("/deposit-requests", authMiddleware, roleMiddleware(["admin"]), walletController.getAdminDepositRequests);
router.patch("/deposit/:id/approve", authMiddleware, roleMiddleware(["admin"]), walletController.approveDeposit);
router.patch("/deposit/:id/reject", authMiddleware, roleMiddleware(["admin"]), walletController.rejectDeposit);
router.get("/withdraw-requests", authMiddleware, roleMiddleware(["admin"]), walletController.getAdminWithdrawRequests);
router.patch("/withdraw/:id/approve", authMiddleware, roleMiddleware(["admin"]), walletController.approveWithdraw);
router.patch("/withdraw/:id/reject", authMiddleware, roleMiddleware(["admin"]), walletController.rejectWithdraw);
router.patch("/withdraw/:id/complete", authMiddleware, roleMiddleware(["admin"]), walletController.completeWithdraw);

module.exports = router;
