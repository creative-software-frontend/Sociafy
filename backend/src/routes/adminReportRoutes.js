const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const controller = require("../controllers/reportController");

const adminOnly = [authMiddleware, roleMiddleware(["admin"])]
router.get("/reports/users", ...adminOnly, controller.adminList);
router.patch("/reports/users/:id", ...adminOnly, controller.adminReview);
router.get("/report-reasons", ...adminOnly, controller.adminReasonList);
router.post("/report-reasons", ...adminOnly, controller.adminReasonCreate);
router.put("/report-reasons/:id", ...adminOnly, controller.adminReasonUpdate);
router.patch("/report-reasons/:id/toggle", ...adminOnly, controller.adminReasonToggle);
router.delete("/report-reasons/:id", ...adminOnly, controller.adminReasonDelete);
router.patch("/users/:id/ban", ...adminOnly, controller.ban);
router.patch("/users/:id/unban", ...adminOnly, controller.unban);

module.exports = router;