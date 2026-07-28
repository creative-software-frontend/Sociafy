const callService = require("../services/callService");

async function getHistory(req, res) {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        const { filter, search, page, limit } = req.query;
        const result = await callService.getFilteredCallHistory({
            userId,
            role,
            filter: filter || "",
            search: search || "",
            page: Math.max(1, parseInt(page) || 1),
            limit: Math.min(100, Math.max(1, parseInt(limit) || 20)),
        });
        return res.json(result);
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
