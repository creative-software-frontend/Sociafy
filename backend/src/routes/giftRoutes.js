const express = require("express");
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const giftController = require("../controllers/giftController");
const { uploadImageMiddleware } = require("../middleware/uploadImageMiddleware");
const { giftHttpLimiter } = require("../config/rateLimits");

// ── Public / User gift routes (mounted at /api/gift) ──
const userRouter = express.Router();

userRouter.get("/list", authMiddleware, giftController.listGifts);
userRouter.get("/assets", authMiddleware, giftController.listAssets);
userRouter.get("/history", authMiddleware, giftController.getHistory);
userRouter.post("/send", authMiddleware, giftHttpLimiter, giftController.sendGift);

// ── Admin gift management (mounted at /api/admin/gifts) ──
const adminRouter = express.Router();

adminRouter.get("/", authMiddleware, roleMiddleware(["admin"]), giftController.adminListGifts);
adminRouter.post("/", authMiddleware, roleMiddleware(["admin"]), giftController.adminCreateGift);
adminRouter.put("/:id", authMiddleware, roleMiddleware(["admin"]), giftController.adminUpdateGift);
adminRouter.patch("/:id/toggle", authMiddleware, roleMiddleware(["admin"]), giftController.adminToggleGift);
adminRouter.delete("/:id", authMiddleware, roleMiddleware(["admin"]), giftController.adminDeleteGift);

// ── Admin Gift Asset Library (multipart upload for POST /assets) ──
adminRouter.get("/assets", authMiddleware, roleMiddleware(["admin"]), giftController.adminListAssets);
adminRouter.post(
    "/assets",
    authMiddleware,
    roleMiddleware(["admin"]),
    (req, res) => {
        uploadImageMiddleware(req, res, (err) => {
            if (err) {
                // Multer validation/limits errors (safe messages only).
                return res.status(400).json({ message: err.message || "Upload failed" });
            }
            return giftController.adminCreateAsset(req, res);
        });
    }
);
adminRouter.patch("/assets/:id", authMiddleware, roleMiddleware(["admin"]), giftController.adminUpdateAsset);
adminRouter.delete("/assets/:id", authMiddleware, roleMiddleware(["admin"]), giftController.adminDeleteAsset);

module.exports = { userRouter, adminRouter };