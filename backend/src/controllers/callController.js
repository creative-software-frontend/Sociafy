const db = require("../config/db");
const callService = require("../services/callService");
const { handleError } = require("../utils/httpError");

async function getHistory(req, res) {
    try {
        const userId = req.user.id;
        // Resolve role from the database, not the (potentially stale) JWT claim,
        // so a user demoted after login cannot keep admin-level access.
        const [rows] = await db.query("SELECT role FROM users WHERE id = ?", [userId]);
        const role = rows.length ? rows[0].role : req.user.role;
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
        return handleError(res, err, "Failed to fetch call history");
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
        return handleError(res, err, "Failed to fetch call");
    }
}

module.exports = { getHistory, getCall };
