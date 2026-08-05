const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const giftController = require("../controllers/giftController");

// ── Public / User gift routes (mounted at /api/gift) ──
const userRouter = express.Router();

userRouter.get("/list", authMiddleware, giftController.listGifts);
userRouter.get("/history", authMiddleware, giftController.getHistory);
userRouter.post("/send", authMiddleware, giftController.sendGift);

// ── Admin gift management (mounted at /api/admin/gifts) ──
const adminRouter = express.Router();

adminRouter.get("/", authMiddleware, roleMiddleware(["admin"]), giftController.adminListGifts);
adminRouter.post("/", authMiddleware, roleMiddleware(["admin"]), giftController.adminCreateGift);
adminRouter.put("/:id", authMiddleware, roleMiddleware(["admin"]), giftController.adminUpdateGift);
adminRouter.patch("/:id/toggle", authMiddleware, roleMiddleware(["admin"]), giftController.adminToggleGift);
adminRouter.delete("/:id", authMiddleware, roleMiddleware(["admin"]), giftController.adminDeleteGift);

module.exports = { userRouter, adminRouter };