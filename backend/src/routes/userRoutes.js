const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { membershipExpiryMiddleware, requireFeature, checkFeatureAccess } = require("../middleware/membershipMiddleware");

const db = require("../config/db");
const walletService = require("../services/walletService");
const { validateEventJoin } = require("../services/eventJoinService");

const { getProfile, updateProfile } = require("../controllers/profileController");
const { changePassword } = require("../controllers/authController");
const { passwordChangeLimiter } = require("../config/rateLimits");

function parseCsvInterests(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    return String(value)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function buildInterestWhereClause(interestsArr, placeholderStartIndex = 1) {
    // returns { clause: '(...)', params: [] }
    if (!interestsArr || interestsArr.length === 0) return { clause: '', params: [] };

    // Match any interest token using LIKE against the comma-separated interests column.
    // We'll implement as: (interests LIKE ? OR interests LIKE ? ...)
    const likeClauses = [];
    const params = [];
    for (const interest of interestsArr) {
        likeClauses.push('interests LIKE ?');
        params.push(`%${interest}%`);
    }
    return { clause: `AND (${likeClauses.join(' OR ')})`, params };
}

// GET /api/user/profile
// Profile viewing is public for all authenticated users regardless of membership.
// It must NEVER require a membership feature.
router.get("/profile", authMiddleware, getProfile);


// PUT /api/user/profile
router.put("/profile", authMiddleware, updateProfile);

// POST /api/user/change-password
router.post("/change-password", authMiddleware, passwordChangeLimiter, changePassword);

// GET /api/user/search
// Query params (all optional): keyword, gender, ageMin, ageMax, profession, education, location, relationship_goal, marital_status, interests, page, pageSize
router.get("/search", authMiddleware, requireFeature("PARTNER_SEARCH"), async (req, res) => {
    const userId = req.user.id;

    const {
        keyword,
        gender,
        ageMin,
        ageMax,
        profession,
        education,
        location,
        relationship_goal,
        marital_status,
        interests,
        page,
        pageSize,
    } = req.query || {};

    const advancedFilters = [ageMin, ageMax, profession, education, location, relationship_goal, marital_status, interests];
    const hasAdvancedFilters = advancedFilters.some(val => val !== undefined && val !== null && String(val).trim() !== "");

    if (hasAdvancedFilters) {
        const check = await checkFeatureAccess(userId, "ADVANCED_SEARCH");
        if (!check.allowed) {
            return res.status(403).json({
                success: false,
                message: "Upgrade membership to access advanced search"
            });
        }
    }

    const pageNum = Math.max(1, parseInt(String(page ?? 1), 10) || 1);
    const sizeNum = Math.min(50, Math.max(1, parseInt(String(pageSize ?? 12), 10) || 12));
    const offset = (pageNum - 1) * sizeNum;

    const where = ["id != ?", "role = ?"];
    const params = [userId, "provider"];

    if (gender) {
        where.push("gender = ?");
        params.push(String(gender));
    }

    // Age filtering: derive age from date_of_birth
    // MySQL: TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE())
    const ageMinNum = ageMin !== undefined ? parseInt(String(ageMin), 10) : null;
    const ageMaxNum = ageMax !== undefined ? parseInt(String(ageMax), 10) : null;

    if (!Number.isNaN(ageMinNum) && ageMinNum !== null) {
        where.push("date_of_birth IS NOT NULL");
        where.push("TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) >= ?");
        params.push(ageMinNum);
    }

    if (!Number.isNaN(ageMaxNum) && ageMaxNum !== null) {
        where.push("date_of_birth IS NOT NULL");
        where.push("TIMESTAMPDIFF(YEAR, date_of_birth, CURDATE()) <= ?");
        params.push(ageMaxNum);
    }

    if (profession) {
        where.push("profession LIKE ?");
        params.push(`%${String(profession).trim()}%`);
    }

    if (education) {
        where.push("education = ?");
        params.push(String(education));
    }

    if (location) {
        where.push("location LIKE ?");
        params.push(`%${String(location).trim()}%`);
    }

    if (relationship_goal) {
        where.push("relationship_goal = ?");
        params.push(String(relationship_goal));
    }

    if (marital_status) {
        where.push("marital_status = ?");
        params.push(String(marital_status));
    }

    if (keyword) {
        const kw = String(keyword).trim();
        if (kw) {
            where.push("(name LIKE ? OR profession LIKE ? OR education LIKE ? OR location LIKE ? OR bio LIKE ?)");
            const kwLike = `%${kw}%`;
            params.push(kwLike, kwLike, kwLike, kwLike, kwLike);
        }
    }

    const interestsArr = parseCsvInterests(interests);
    const interestClause = buildInterestWhereClause(interestsArr);
    if (interestClause.clause) {
        where.push(interestClause.clause.replace(/^AND\s+/i, ''));
        params.push(...interestClause.params);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM users ${whereSql}`;
    const listSql = `
        SELECT id,
               name,
               gender,
               date_of_birth,
               profession,
               education,
               location,
               relationship_goal,
               marital_status,
               interests,
               avatar_url,
               created_at
        FROM users
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.query(countSql, params, (countErr, countRows) => {
        if (countErr) return res.status(500).json({ message: 'Database error' });
        const total = countRows?.[0]?.total ?? 0;

        db.query(listSql, [...params, sizeNum, offset], (listErr, users) => {
            if (listErr) return res.status(500).json({ message: 'Database error' });
            res.json({
                total,
                page: pageNum,
                pageSize: sizeNum,
                results: users || [],
            });
        });
    });
});

// Match Requests
// POST /api/user/match-request
router.post("/match-request", authMiddleware, (req, res) => {
    const senderId = req.user.id;
    const { receiver_id } = req.body || {};
    const receiverId = parseInt(String(receiver_id), 10);

    if (!receiverId || receiverId === senderId) {
        return res.status(400).json({ message: 'Cannot send request to yourself' });
    }

    // Prevent duplicate pending requests + disallow if already accepted
    db.query(
        "SELECT status FROM match_requests WHERE sender_id = ? AND receiver_id = ? ORDER BY created_at DESC LIMIT 1",
        [senderId, receiverId],
        (err, rows) => {
            if (err) return res.status(500).json({ message: 'Database error' });

            if (rows && rows.length > 0) {
                const status = rows[0].status;
                if (status === 'pending') {
                    return res.status(400).json({ message: 'Duplicate pending request' });
                }
                if (status === 'accepted') {
                    return res.status(400).json({ message: 'Already matched' });
                }
            }

            // Also prevent receiver having accepted incoming from sender (either direction is a match)
            db.query(
                "SELECT status FROM match_requests WHERE sender_id = ? AND receiver_id = ? AND status IN ('accepted') LIMIT 1",
                [receiverId, senderId],
                (err2, rows2) => {
                    if (err2) return res.status(500).json({ message: 'Database error' });
                    if (rows2 && rows2.length > 0) {
                        return res.status(400).json({ message: 'Already matched' });
                    }

                    db.query(
                        "INSERT INTO match_requests (sender_id, receiver_id, status) VALUES (?, ?, 'pending')",
                        [senderId, receiverId],
                        (err3) => {
                            if (err3) return res.status(500).json({ message: 'Database error' });
                            res.json({ message: 'Match request sent' });
                        }
                    );
                }
            );
        }
    );
});

// GET /api/user/match-request
router.get("/match-request", authMiddleware, (req, res) => {
    const userId = req.user.id;

    const outgoingSql = `
        SELECT mr.id,
               mr.sender_id,
               mr.receiver_id,
               mr.status,
               mr.created_at,
               u.name,
               u.avatar_url,
               u.gender,
               u.date_of_birth,
               u.profession,
               u.location,
               u.relationship_goal,
               u.interests
        FROM match_requests mr
        JOIN users u ON u.id = mr.receiver_id
        WHERE mr.sender_id = ?
        ORDER BY mr.created_at DESC
    `;

    const incomingSql = `
        SELECT mr.id,
               mr.sender_id,
               mr.receiver_id,
               mr.status,
               mr.created_at,
               u.name,
               u.avatar_url,
               u.gender,
               u.date_of_birth,
               u.profession,
               u.location,
               u.relationship_goal,
               u.interests
        FROM match_requests mr
        JOIN users u ON u.id = mr.sender_id
        WHERE mr.receiver_id = ?
        ORDER BY mr.created_at DESC
    `;

    db.query(incomingSql, [userId], (inErr, incomingRows) => {
        if (inErr) return res.status(500).json({ message: 'Database error' });
        db.query(outgoingSql, [userId], (outErr, outgoingRows) => {
            if (outErr) return res.status(500).json({ message: 'Database error' });
            res.json({ incoming: incomingRows || [], outgoing: outgoingRows || [] });
        });
    });
});

// POST /api/user/match-request/:id/accept
router.post("/match-request/:id/accept", authMiddleware, (req, res) => {
    const userId = req.user.id;
    const id = parseInt(String(req.params.id), 10);

    db.query(
        "SELECT receiver_id, sender_id, status FROM match_requests WHERE id = ? LIMIT 1",
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (!rows || rows.length === 0) return res.status(404).json({ message: 'Request not found' });

            const row = rows[0];
            if (row.receiver_id !== userId) {
                return res.status(403).json({ message: 'Not allowed' });
            }
            if (row.status === 'accepted') {
                return res.status(400).json({ message: 'Already accepted' });
            }

            db.query(
                "UPDATE match_requests SET status = 'accepted' WHERE id = ?",
                [id],
                (uErr) => {
                    if (uErr) return res.status(500).json({ message: 'Database error' });
                    res.json({ message: 'Request accepted', match_request_id: id });
                }
            );
        }
    );
});

// POST /api/user/match-request/:id/reject
router.post("/match-request/:id/reject", authMiddleware, (req, res) => {
    const userId = req.user.id;
    const id = parseInt(String(req.params.id), 10);

    db.query(
        "SELECT receiver_id FROM match_requests WHERE id = ? LIMIT 1",
        [id],
        (err, rows) => {
            if (err) return res.status(500).json({ message: 'Database error' });
            if (!rows || rows.length === 0) return res.status(404).json({ message: 'Request not found' });

            if (rows[0].receiver_id !== userId) {
                return res.status(403).json({ message: 'Not allowed' });
            }

            db.query(
                "UPDATE match_requests SET status = 'rejected' WHERE id = ?",
                [id],
                (uErr) => {
                    if (uErr) return res.status(500).json({ message: 'Database error' });
                    res.json({ message: 'Request rejected', match_request_id: id });
                }
            );
        }
    );
});



// GET /api/user/wallet
router.get("/wallet", authMiddleware, (req, res) => {
    const userId = req.user.id;

    db.query(
        "SELECT balance, earnings, role FROM users WHERE id = ?",
        [userId],
        (err, userResult) => {
            if (err) return res.status(500).json({ message: "Database error" });
            if (userResult.length === 0) return res.status(404).json({ message: "User not found" });

            const user = userResult[0];

            db.query(
                "SELECT id, type, amount, status, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
                [userId],
                (err2, txResult) => {
                    if (err2) return res.status(500).json({ message: "Database error" });

                    // Seed provider with initial active mockup transactions if empty
                    if (user.role === "provider" && (!txResult || txResult.length === 0)) {
                        db.query(
                            "UPDATE users SET balance = 20500.00 WHERE id = ?",
                            [userId],
                            () => {
                                db.query(
                                    "INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, 'earning', 12500.00, 'completed', 'Platform Service Payout')",
                                    [userId],
                                    () => {
                                        db.query(
                                            "INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, 'withdraw', 4500.00, 'completed', 'Liquidate Payout')",
                                            [userId],
                                            () => {
                                                db.query(
                                                    "SELECT balance, earnings, role FROM users WHERE id = ?",
                                                    [userId],
                                                    (errSeed, seededUser) => {
                                                        db.query(
                                                            "SELECT id, type, amount, status, description, created_at FROM transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
                                                            [userId],
                                                            (errSeedTx, seededTx) => {
                                                                res.json({
                                                                    balance: seededUser[0].balance,
                                                                    earnings: seededUser[0].earnings,
                                                                    role: seededUser[0].role,
                                                                    transactions: seededTx || []
                                                                });
                                                            }
                                                        );
                                                    }
                                                );
                                            }
                                        );
                                    }
                                );
                            }
                        );
                        return;
                    }

                    res.json({
                        balance: user.balance || 0,
                        earnings: user.earnings || 0,
                        role: user.role,
                        transactions: txResult || []
                    });
                }
            );
        }
    );
});

// POST /api/user/deposit
router.post("/deposit", authMiddleware, async (req, res) => {
    try {
        const result = await walletService.createDepositRequest(req.user.id, req.body || {});
        res.status(201).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ message: error.message || "Deposit request failed" });
    }
});

// POST /api/user/withdraw
router.post("/withdraw", authMiddleware, async (req, res) => {
    try {
        const result = await walletService.createWithdrawRequest(req.user.id, req.body || {});
        res.status(201).json(result);
    } catch (error) {
        const status = error.statusCode || 500;
        res.status(status).json({ message: error.message || "Withdrawal request failed" });
    }
});

// Get User Events
router.get("/events", authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT e.*, 
                u.name as creator_name,
                (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) as participant_count,
                IF(EXISTS(SELECT 1 FROM event_participants WHERE event_id = e.id AND user_id = ?), 1, 0) as joined
         FROM events e
         JOIN users u ON e.creator_id = u.id
         ORDER BY e.date_time ASC`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error: " + err.message });
            res.json(rows);
        }
    );
});

// Join Event
router.post("/events/:id/join", authMiddleware, requireFeature("EVENT_ACCESS"), async (req, res) => {
    const userId = req.user.id;

    const eventId = Number(req.params.id);

    if (!Number.isFinite(eventId)) {
        return res.status(400).json({ message: "Invalid event id" });
    }

    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const [eventRows] = await connection.query(
            "SELECT id, title, creator_id, status, capacity, entry_fee FROM events WHERE id = ? FOR UPDATE",
            [eventId]
        );

        if (!eventRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "Event not found" });
        }

        const event = eventRows[0];
        const [participantRows] = await connection.query(
            "SELECT 1 FROM event_participants WHERE event_id = ? AND user_id = ? LIMIT 1 FOR UPDATE",
            [eventId, userId]
        );

        const [userRows] = await connection.query(
            "SELECT id, name, balance, role FROM users WHERE id = ? FOR UPDATE",
            [userId]
        );

        if (!userRows.length) {
            await connection.rollback();
            return res.status(404).json({ message: "User not found" });
        }

        const user = userRows[0];
        const hasJoined = participantRows.length > 0;
        const currentParticipantCount = (await connection.query(
            "SELECT COUNT(*) as count FROM event_participants WHERE event_id = ?",
            [eventId]
        ))[0][0].count;

        try {
            validateEventJoin({
                event,
                currentParticipantCount,
                hasJoined,
                userBalance: user.balance,
            });
        } catch (validationError) {
            await connection.rollback();
            return res.status(validationError.statusCode || 400).json({ message: validationError.message });
        }

        const fee = Number(event.entry_fee || 0);
        if (fee > 0) {
            await connection.query(
                "UPDATE users SET balance = balance - ? WHERE id = ?",
                [fee, userId]
            );

            await connection.query(
                "INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, 'event_payment', ?, 'completed', ?)",
                [userId, fee, `Entry fee for ${event.title}`]
            );

            const [providerRows] = await connection.query(
                "SELECT id, name, earnings FROM users WHERE id = ? FOR UPDATE",
                [event.creator_id]
            );

            if (!providerRows.length) {
                await connection.rollback();
                return res.status(404).json({ message: "Event provider not found" });
            }

            await connection.query(
                "UPDATE users SET balance = balance + ? WHERE id = ?",
                [fee, event.creator_id]
            );

            await connection.query(
                "INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, 'event_income', ?, 'completed', ?)",
                [event.creator_id, fee, `Entry fee received from ${user.name}`]
            );
        }

        await connection.query(
            "INSERT INTO event_participants (event_id, user_id) VALUES (?, ?)",
            [eventId, userId]
        );

        await connection.commit();
        res.json({ message: "Successfully joined the event" });
    } catch (error) {
        await connection.rollback();
        res.status(500).json({ message: "Database error: " + error.message });
    } finally {
        connection.release();
    }
});

// Leave Event
router.post("/events/:id/leave", authMiddleware, (req, res) => {
    const userId = req.user.id;
    const eventId = req.params.id;

    db.query(
        "DELETE FROM event_participants WHERE event_id = ? AND user_id = ?",
        [eventId, userId],
        (err, result) => {
            if (err) return res.status(500).json({ message: "Database error: " + err.message });
            if (result.affectedRows === 0) {
                return res.status(400).json({ message: "You are not a participant in this event" });
            }
            res.json({ message: "Successfully left the event" });
        }
    );
});

// ── GET /api/user/providers ──────────────────────────────────────────────────
// Returns all provider profiles for the user's "Models" quick-link.
router.get("/providers", authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT id, name, avatar_url, profession, location, interests, date_of_birth
         FROM users
         WHERE role = 'provider'
           AND id != ?
           AND is_active = 1
         ORDER BY created_at DESC
         LIMIT 50`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error: " + err.message });
            res.json(rows || []);
        }
    );
});

// ── GET /api/user/event-locations ────────────────────────────────────────────
// Returns distinct event locations for the user's "Places" quick-link.
router.get("/event-locations", authMiddleware, (req, res) => {
    db.query(
        `SELECT
            location,
            COUNT(*) AS event_count,
            MIN(CASE WHEN date_time >= NOW() THEN date_time END) AS next_event
         FROM events
         WHERE status = 'active' AND location IS NOT NULL AND location != ''
         GROUP BY location
         ORDER BY next_event ASC, event_count DESC
         LIMIT 20`,
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error: " + err.message });
            res.json(rows || []);
        }
    );
});

// ── GET /api/user/joined-events ──────────────────────────────────────────────
// Returns events the current user has joined (for the BOOKINGS quick-link).
router.get("/joined-events", authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT e.id, e.title, e.description, e.date_time, e.location, e.capacity, e.status,
                e.host_name, e.entry_fee, e.created_at,
                (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) as participant_count
         FROM events e
         JOIN event_participants ep ON ep.event_id = e.id
         WHERE ep.user_id = ?
         ORDER BY e.date_time ASC`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error: " + err.message });
            res.json(rows || []);
        }
    );
});

// ── GET /api/user/recent-activity ────────────────────────────────────────────
// Returns recent activity for the user dashboard: joined events and friends
// added (accepted match requests), newest first.
router.get("/recent-activity", authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.query(
        `(
            SELECT
                'event_join' AS type,
                ep.event_id AS id,
                'joined' AS status,
                ep.joined_at AS created_at,
                e.title AS detail,
                e.location AS extra,
                u.name AS counterpart_name,
                u.avatar_url AS counterpart_avatar
            FROM event_participants ep
            JOIN events e ON e.id = ep.event_id
            JOIN users u ON u.id = e.creator_id
            WHERE ep.user_id = ?
            ORDER BY ep.joined_at DESC
            LIMIT 5
        )
        UNION ALL
        (
            SELECT
                'friend_added' AS type,
                mr.id,
                mr.status,
                mr.created_at,
                NULL AS detail,
                NULL AS extra,
                u.name AS counterpart_name,
                u.avatar_url AS counterpart_avatar
            FROM match_requests mr
            JOIN users u ON u.id = mr.sender_id
            WHERE mr.receiver_id = ? AND mr.status = 'accepted'
            ORDER BY mr.created_at DESC
            LIMIT 5
        )
        ORDER BY created_at DESC
        LIMIT 10`,
        [userId, userId],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error: " + err.message });
            res.json(rows || []);
        }
    );
});

// ── GET /api/user/featured-providers ─────────────────────────────────────────
// Returns membership-holding providers (providers with an active membership)
// for the user's "Featured Profiles" section: name, age, picture, location.
router.get("/featured-providers", authMiddleware, (req, res) => {
    const userId = req.user.id;
    db.query(
        `SELECT u.id, u.name, u.avatar_url, u.location, u.date_of_birth, u.profession,
                p.name AS membership_package
         FROM users u
         LEFT JOIN packages p ON p.id = u.membership_package_id
         WHERE u.role = 'provider'
           AND u.id != ?
           AND u.is_active = 1
           AND u.membership_package_id IS NOT NULL
           AND (u.membership_expires_at IS NULL OR u.membership_expires_at >= NOW())
         ORDER BY u.created_at DESC
         LIMIT 12`,
        [userId],
        (err, rows) => {
            if (err) return res.status(500).json({ message: "Database error: " + err.message });
            res.json(rows || []);
        }
    );
});

module.exports = router;