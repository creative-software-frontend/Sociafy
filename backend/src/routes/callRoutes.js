const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { getHistory, getCall } = require("../controllers/callController");
const platformSettingsService = require("../services/platformSettingsService");

router.get("/history", authMiddleware, getHistory);

router.get("/rate", authMiddleware, async (req, res) => {
    try {
        const rates = await platformSettingsService.getCallRates();
        res.json(rates);
    } catch (err) {
        res.status(500).json({ message: err.message || "Failed to fetch call rate" });
    }
});

router.get("/:id", authMiddleware, getCall);

module.exports = router;
