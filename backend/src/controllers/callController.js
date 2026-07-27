const callService = require("../services/callService");

async function getHistory(req, res) {
    try {
        const userId = req.user.id;
        const calls = await callService.getCallHistory(userId);
        return res.json({ calls });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch call history" });
    }
}

async function getCall(req, res) {
    try {
        const userId = req.user.id;
        const callId = Number(req.params.id);
        if (!callId || Number.isNaN(callId)) {
            return res.status(400).json({ message: "Invalid call ID" });
        }

        const call = await callService.getCallById(callId, userId);
        if (!call) {
            return res.status(404).json({ message: "Call not found" });
        }

        return res.json({ call });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch call" });
    }
}

module.exports = { getHistory, getCall };
