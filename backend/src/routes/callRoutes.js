const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getHistory, getCall } = require("../controllers/callController");

router.get("/history", authMiddleware, getHistory);
router.get("/:id", authMiddleware, getCall);

module.exports = router;
