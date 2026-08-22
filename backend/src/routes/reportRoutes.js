const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const controller = require("../controllers/reportController");

router.get("/report-reasons", authMiddleware, roleMiddleware(["user", "provider"]), controller.activeReasons);
router.post("/reports", authMiddleware, roleMiddleware(["user", "provider"]), controller.create);

module.exports = router;