const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const depositPaymentController = require("../controllers/depositPaymentController");

// ── User / Provider read (mounted at /api/deposit-methods) ──
// Authenticated user/provider accounts may read only ACTIVE deposit methods.
const userRouter = express.Router();
userRouter.get("/", authMiddleware, depositPaymentController.listActive);

// ── Admin management (mounted at /api/admin/deposit-methods) ──
// Create / update / enable / disable payment methods — admin-only.
const adminRouter = express.Router();
adminRouter.get("/", authMiddleware, roleMiddleware(["admin"]), depositPaymentController.adminList);
adminRouter.post("/", authMiddleware, roleMiddleware(["admin"]), depositPaymentController.adminCreate);
adminRouter.put("/:id", authMiddleware, roleMiddleware(["admin"]), depositPaymentController.adminUpdate);
adminRouter.patch("/:id/toggle", authMiddleware, roleMiddleware(["admin"]), depositPaymentController.adminToggle);

module.exports = { userRouter, adminRouter };