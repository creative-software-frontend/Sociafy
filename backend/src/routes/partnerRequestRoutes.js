const express = require("express");
const router = express.Router();

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { requireFeature } = require("../middleware/membershipMiddleware");

const db = require("../config/db");

/**
 * partner_requests — USER → PROVIDER connection workflow.
 *
 * Endpoints:
 *   POST /api/partner/request                 (user)    send a request to a provider
 *   GET  /api/provider/partner-requests       (provider) list incoming requests
 *   POST /api/provider/partner-request/:id/accept  (provider) accept a request
 *   POST /api/provider/partner-request/:id/reject  (provider) reject a request
 *   GET  /api/partner/status/:providerId      (user)    status of current user's request to a provider
 *
 * Chat + full profile access are unlocked only when status = 'accepted'.
 */

// ── POST /api/partner/request ────────────────────────────────────────────────
// A USER sends a partner request to a PROVIDER.
router.post(
    "/request",
    authMiddleware,
    roleMiddleware(["user"]),
    (req, res) => {
        const userId = req.user.id;
        const { provider_id } = req.body || {};
        const providerId = parseInt(String(provider_id), 10);

        if (!providerId || Number.isNaN(providerId)) {
            return res.status(400).json({ message: "provider_id is required" });
        }
        if (providerId === userId) {
            return res.status(400).json({ message: "Cannot send a request to yourself" });
        }

        // Validate the target is actually a provider.
        db.query(
            "SELECT id, role FROM users WHERE id = ? LIMIT 1",
            [providerId],
            (err, rows) => {
                if (err) return res.status(500).json({ message: "An internal server error occurred." });
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ message: "Provider not found" });
                }
                if (rows[0].role !== "provider") {
                    return res.status(400).json({ message: "Target user is not a provider" });
                }

                // Prevent duplicate active requests. The UNIQUE KEY also guards
                // this at the DB level, but we return a friendly message here.
                db.query(
                    `SELECT id, status FROM partner_requests
                     WHERE user_id = ? AND provider_id = ?
                     ORDER BY created_at DESC LIMIT 1`,
                    [userId, providerId],
                    (err2, existing) => {
                        if (err2) return res.status(500).json({ message: "An internal server error occurred." });

                        if (existing && existing.length > 0) {
                            const st = existing[0].status;
                            if (st === "pending") {
                                return res.status(400).json({ message: "Request already pending", status: st });
                            }
                            if (st === "accepted") {
                                return res.status(400).json({ message: "Request already accepted", status: st });
                            }
                            // rejected / cancelled → allow a fresh request (re-insert).
                        }

                        db.query(
                            "INSERT INTO partner_requests (user_id, provider_id, status) VALUES (?, ?, 'pending')",
                            [userId, providerId],
                            (err3, result) => {
                                if (err3) {
                                    // Duplicate-key race (UNIQUE (user_id, provider_id)).
                                    if (err3.code === "ER_DUP_ENTRY") {
                                        return res.status(400).json({ message: "Request already pending", status: "pending" });
                                    }
                                    return res.status(500).json({ message: "An internal server error occurred." });
                                }
                                return res.status(201).json({
                                    message: "Partner request sent",
                                    request_id: result.insertId,
                                    status: "pending",
                                });
                            }
                        );
                    }
                );
            }
        );
    }
);

// ── GET /api/provider/partner-requests ───────────────────────────────────────
// A PROVIDER lists incoming partner requests (with requester profile info).
router.get(
    "/partner-requests",
    authMiddleware,
    roleMiddleware(["provider"]),
    requireFeature("MY_EVENTS"),
    (req, res) => {
        const providerId = req.user.id;

        const sql = `
            SELECT pr.id,
                   pr.user_id,
                   pr.provider_id,
                   pr.status,
                   pr.created_at,
                   pr.updated_at,
                   u.name,
                   u.avatar_url,
                   u.gender,
                   u.date_of_birth,
                   u.location,
                   u.profession,
                   u.interests,
                   u.bio
            FROM partner_requests pr
            JOIN users u ON u.id = pr.user_id
            WHERE pr.provider_id = ?
            ORDER BY
                CASE pr.status WHEN 'pending' THEN 0 ELSE 1 END,
                pr.created_at DESC
        `;

        db.query(sql, [providerId], (err, rows) => {
            if (err) return res.status(500).json({ message: "An internal server error occurred." });
            res.json({ requests: rows || [] });
        });
    }
);

// ── POST /api/provider/partner-request/:id/accept ────────────────────────────
router.post(
    "/partner-request/:id/accept",
    authMiddleware,
    roleMiddleware(["provider"]),
    requireFeature("MY_EVENTS"),
    (req, res) => {
        const providerId = req.user.id;
        const id = parseInt(String(req.params.id), 10);

        db.query(
            "SELECT id, provider_id, user_id, status FROM partner_requests WHERE id = ? LIMIT 1",
            [id],
            (err, rows) => {
                if (err) return res.status(500).json({ message: "An internal server error occurred." });
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ message: "Request not found" });
                }
                const row = rows[0];
                if (row.provider_id !== providerId) {
                    return res.status(403).json({ message: "Not allowed" });
                }
                if (row.status === "accepted") {
                    return res.status(400).json({ message: "Already accepted", status: "accepted" });
                }

                db.query(
                    "UPDATE partner_requests SET status = 'accepted' WHERE id = ?",
                    [id],
                    (uErr) => {
                        if (uErr) return res.status(500).json({ message: "An internal server error occurred." });
                        res.json({ message: "Request accepted", request_id: id, status: "accepted" });
                    }
                );
            }
        );
    }
);

// ── POST /api/provider/partner-request/:id/reject ────────────────────────────
router.post(
    "/partner-request/:id/reject",
    authMiddleware,
    roleMiddleware(["provider"]),
    requireFeature("MY_EVENTS"),
    (req, res) => {
        const providerId = req.user.id;
        const id = parseInt(String(req.params.id), 10);

        db.query(
            "SELECT id, provider_id, status FROM partner_requests WHERE id = ? LIMIT 1",
            [id],
            (err, rows) => {
                if (err) return res.status(500).json({ message: "An internal server error occurred." });
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ message: "Request not found" });
                }
                const row = rows[0];
                if (row.provider_id !== providerId) {
                    return res.status(403).json({ message: "Not allowed" });
                }
                if (row.status === "rejected") {
                    return res.status(400).json({ message: "Already rejected", status: "rejected" });
                }

                db.query(
                    "UPDATE partner_requests SET status = 'rejected' WHERE id = ?",
                    [id],
                    (uErr) => {
                        if (uErr) return res.status(500).json({ message: "An internal server error occurred." });
                        res.json({ message: "Request rejected", request_id: id, status: "rejected" });
                    }
                );
            }
        );
    }
);

// ── GET /api/partner/status/:providerId ──────────────────────────────────────
// A USER checks the status of their request to a given provider.
// Returns null status when no request exists.
router.get(
    "/status/:providerId",
    authMiddleware,
    roleMiddleware(["user"]),
    (req, res) => {
        const userId = req.user.id;
        const providerId = parseInt(String(req.params.providerId), 10);

        if (!providerId || Number.isNaN(providerId)) {
            return res.status(400).json({ message: "providerId is required" });
        }

        db.query(
            `SELECT id, status, created_at, updated_at
             FROM partner_requests
             WHERE user_id = ? AND provider_id = ?
             ORDER BY created_at DESC LIMIT 1`,
            [userId, providerId],
            (err, rows) => {
                if (err) return res.status(500).json({ message: "An internal server error occurred." });
                if (!rows || rows.length === 0) {
                    return res.json({ status: null });
                }
                return res.json({ status: rows[0].status, request: rows[0] });
            }
        );
    }
);

// ── GET /api/partner/profile/:providerId ─────────────────────────────────────
// A USER views a PROVIDER's profile. Before an accepted partner request only
// public fields are returned; after acceptance the full profile is returned.
//   public:  id, name, avatar_url, profession, location, interests, age, bio
//   full:    + gender, date_of_birth, education, relationship_goal, marital_status, phone, email
router.get(
    "/profile/:providerId",
    authMiddleware,
    roleMiddleware(["user"]),
    (req, res) => {
        const userId = req.user.id;
        const providerId = parseInt(String(req.params.providerId), 10);

        if (!providerId || Number.isNaN(providerId)) {
            return res.status(400).json({ message: "providerId is required" });
        }

        db.query(
            "SELECT id, role FROM users WHERE id = ? LIMIT 1",
            [providerId],
            (err, rows) => {
                if (err) return res.status(500).json({ message: "An internal server error occurred." });
                if (!rows || rows.length === 0) {
                    return res.status(404).json({ message: "Provider not found" });
                }
                if (rows[0].role !== "provider") {
                    return res.status(400).json({ message: "Target user is not a provider" });
                }

                db.query(
                    `SELECT status FROM partner_requests
                     WHERE user_id = ? AND provider_id = ?
                     ORDER BY created_at DESC LIMIT 1`,
                    [userId, providerId],
                    (err2, prRows) => {
                        if (err2) return res.status(500).json({ message: "An internal server error occurred." });
                        const status = prRows && prRows.length ? prRows[0].status : null;
                        const full = status === "accepted";

                        const publicCols = [
                            "id", "name", "avatar_url", "profession", "location",
                            "interests", "date_of_birth", "bio",
                        ];
                        const fullCols = [
                            "gender", "education", "relationship_goal",
                            "marital_status", "phone", "email",
                        ];
                        const cols = full ? [...publicCols, ...fullCols] : publicCols;

                        db.query(
                            `SELECT ${cols.map((c) => `\`${c}\``).join(", ")} FROM users WHERE id = ? LIMIT 1`,
                            [providerId],
                            (err3, profRows) => {
                                if (err3) return res.status(500).json({ message: "An internal server error occurred." });
                                if (!profRows || profRows.length === 0) {
                                    return res.status(404).json({ message: "Provider not found" });
                                }
                                return res.json({
                                    profile: profRows[0],
                                    access: full ? "full" : "public",
                                    partner_status: status,
                                });
                            }
                        );
                    }
                );
            }
        );
    }
);

// ── GET /api/provider/requester-profile/:userId ─────────────────────────────
// A PROVIDER views a requester's (user) profile. Before accepting the request
// only public fields are returned; after acceptance the full profile is returned.
router.get(
    "/requester-profile/:userId",
    authMiddleware,
    roleMiddleware(["provider"]),
    (req, res) => {
        const providerId = req.user.id;
        const userId = parseInt(String(req.params.userId), 10);

        if (!userId || Number.isNaN(userId)) {
            return res.status(400).json({ message: "userId is required" });
        }

        db.query(
            `SELECT status FROM partner_requests
             WHERE user_id = ? AND provider_id = ?
             ORDER BY created_at DESC LIMIT 1`,
            [userId, providerId],
            (err, prRows) => {
                if (err) return res.status(500).json({ message: "An internal server error occurred." });
                const status = prRows && prRows.length ? prRows[0].status : null;
                const full = status === "accepted";

                const publicCols = [
                    "id", "name", "avatar_url", "profession", "location",
                    "interests", "date_of_birth", "bio",
                ];
                const fullCols = [
                    "gender", "education", "relationship_goal",
                    "marital_status", "phone", "email",
                ];
                const cols = full ? [...publicCols, ...fullCols] : publicCols;

                db.query(
                    `SELECT ${cols.map((c) => `\`${c}\``).join(", ")} FROM users WHERE id = ? LIMIT 1`,
                    [userId],
                    (err2, profRows) => {
                        if (err2) return res.status(500).json({ message: "An internal server error occurred." });
                        if (!profRows || profRows.length === 0) {
                            return res.status(404).json({ message: "User not found" });
                        }
                        return res.json({
                            profile: profRows[0],
                            access: full ? "full" : "public",
                            partner_status: status,
                        });
                    }
                );
            }
        );
    }
);

module.exports = router;
