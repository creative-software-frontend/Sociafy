const express = require("express");
const router = express.Router();
const { handleError } = require("../utils/httpError");

const authMiddleware = require("../middleware/authMiddleware");
const roleMiddleware = require("../middleware/roleMiddleware");
const { requireFeature } = require("../middleware/membershipMiddleware");

const db = require("../config/db");
const newsfeedController = require("../controllers/newsfeedController");
const chatService = require("../services/chatService");
const { checkChatPermission } = chatService;

// BEFORE (NOT GOOD)
// router.get("/provider-dashboard", ...)

// NOW (CLEAN STRUCTURE)
router.get(
    "/dashboard",
    authMiddleware,
    roleMiddleware(["provider"]),
    (req, res) => {
        res.json({ message: "Welcome provider" });
    }
);

router.get(
    "/common",
    authMiddleware,
    roleMiddleware(["user", "provider"]),
    (req, res) => {
        res.json({ message: "Common access" });
    }
);

// GET /api/provider/online-providers
// Provider dashboard presence: "online" = authenticated request within last 60 seconds
router.get(
    "/online-providers",
    authMiddleware,
    roleMiddleware(["provider", "user", "admin"]),
    requireFeature("CHAT"),
    (req, res) => {
        db.query(
            `
            SELECT id, name, last_seen, is_online
            FROM users
            WHERE role = 'provider'
              AND (is_online = 1 OR last_seen >= NOW() - INTERVAL 60 SECOND)
            ORDER BY is_online DESC, last_seen DESC
            `,
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows);
            }
        );
    }
);

// GET /api/provider/online-users
// Provider chat list = users who have a partner request (pending OR accepted)
// OR users who have sent/received a chat message with this provider.
// Online status is surfaced for the presence indicator.
router.get(
    "/online-users",
    authMiddleware,
    roleMiddleware(["provider", "user", "admin"]),
    (req, res) => {
        const providerId = req.user.id;
        db.query(
            `
            SELECT u.id, u.name, u.last_seen, u.is_online,
                   MAX(pr.status) AS request_status
            FROM (
                -- Source 1: partner requests (pending or accepted)
                SELECT pr.user_id AS partner_uid, pr.status
                FROM partner_requests pr
                WHERE pr.provider_id = ?
                  AND pr.status IN ('pending', 'accepted')

                UNION

                -- Source 2: chat messages where provider is involved
                SELECT CASE
                         WHEN cm.sender_id = ? THEN cm.receiver_id
                         ELSE cm.sender_id
                       END AS partner_uid,
                       NULL AS status
                FROM chat_messages cm
                WHERE cm.sender_id = ? OR cm.receiver_id = ?
            ) AS combined
            JOIN users u ON u.id = combined.partner_uid
            LEFT JOIN partner_requests pr
                   ON pr.user_id = u.id AND pr.provider_id = ?
                  AND pr.status IN ('pending', 'accepted')
            WHERE u.id != ?
            GROUP BY u.id, u.name, u.last_seen, u.is_online
            ORDER BY
                CASE WHEN MAX(pr.status) = 'accepted' THEN 0 ELSE 1 END,
                u.is_online DESC, u.last_seen DESC
            `,
            [providerId, providerId, providerId, providerId, providerId, providerId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows);
            }
        );
    }
);

// ── GET /api/provider/active-providers (for user dashboard)
// User chat list = providers who have a partner request (pending OR accepted)
// with this user, OR providers with whom the user has exchanged messages.
router.get(
    "/active-providers",
    authMiddleware,
    roleMiddleware(["user", "provider", "admin"]),
    (req, res) => {
        const userId = req.user.id;
        db.query(
            `
            SELECT u.id, u.name, u.last_seen, u.is_online,
                   MAX(pr.status) AS request_status
            FROM (
                -- Source 1: partner requests (pending or accepted)
                SELECT pr.provider_id AS partner_uid, pr.status
                FROM partner_requests pr
                WHERE pr.user_id = ?
                  AND pr.status IN ('pending', 'accepted')

                UNION

                -- Source 2: chat messages where user is involved
                SELECT CASE
                         WHEN cm.sender_id = ? THEN cm.receiver_id
                         ELSE cm.sender_id
                       END AS partner_uid,
                       NULL AS status
                FROM chat_messages cm
                WHERE cm.sender_id = ? OR cm.receiver_id = ?
            ) AS combined
            JOIN users u ON u.id = combined.partner_uid
            LEFT JOIN partner_requests pr
                   ON pr.provider_id = u.id AND pr.user_id = ?
                  AND pr.status IN ('pending', 'accepted')
            WHERE u.id != ?
            GROUP BY u.id, u.name, u.last_seen, u.is_online
            ORDER BY
                CASE WHEN MAX(pr.status) = 'accepted' THEN 0 ELSE 1 END,
                u.is_online DESC, u.last_seen DESC
            `,
            [userId, userId, userId, userId, userId, userId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows);
            }
        );
    }
);

// ── GET /api/provider/posts — get all posts with author info + interaction counts
router.get(
    "/posts",
    authMiddleware,
    roleMiddleware(["user", "provider", "admin"]),
    (req, res) => {
        const userId = req.user.id;
        db.query(
            `SELECT p.id, p.content, p.image_url, p.created_at,
                    u.id AS user_id, u.name AS author_name, u.role AS author_role,
                    (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
                    (SELECT COUNT(*) FROM post_comments pc WHERE pc.post_id = p.id) AS comment_count,
                    (SELECT COUNT(*) FROM post_shares ps WHERE ps.post_id = p.id) AS share_count,
                    (SELECT COUNT(*) FROM post_likes pl2 WHERE pl2.post_id = p.id AND pl2.user_id = ?) AS user_has_liked
             FROM posts p
             JOIN users u ON u.id = p.user_id
             ORDER BY p.created_at DESC
             LIMIT 50`,
            [userId],
            (err, rows) => {
                if (err) return handleError(res, err);
                const mapped = rows.map(r => ({
                    ...r,
                    like_count: Number(r.like_count),
                    comment_count: Number(r.comment_count),
                    share_count: Number(r.share_count),
                    user_has_liked: Number(r.user_has_liked) > 0,
                }));
                res.json(mapped);
            }
        );
    }
);

// ── POST /api/provider/posts — create a new post
router.post(
    "/posts",
    authMiddleware,
    roleMiddleware(["user", "provider"]),
    (req, res) => {
        const { content, image_url } = req.body;
        if (!content || !content.trim()) {
            return res.status(400).json({ message: "Post content cannot be empty." });
        }
        const userId = req.user.id;
        db.query(
            `INSERT INTO posts (user_id, content, image_url) VALUES (?, ?, ?)`,
            [userId, content.trim(), image_url || null],
            (err, result) => {
                if (err) return handleError(res, err);
                // Return new post with author info
                db.query(
                    `SELECT p.id, p.content, p.image_url, p.created_at,
                            u.id AS user_id, u.name AS author_name, u.role AS author_role
                     FROM posts p JOIN users u ON u.id = p.user_id
                     WHERE p.id = ?`,
                    [result.insertId],
                    (err2, rows) => {
                        if (err2) return res.status(500).json({ message: err2.message });
                        res.status(201).json(rows[0]);
                    }
                );
            }
        );
    }
);

// ── GET /api/provider/messages?with=<userId> — get DM thread
router.get(
    "/messages",
    authMiddleware,
    roleMiddleware(["user", "provider"]),
    requireFeature("CHAT"),
    async (req, res) => {

        const me = req.user.id;
        const partner = parseInt(req.query.with, 10);
        if (!partner) return res.status(400).json({ message: "Missing 'with' query param." });

        // Partner-request chat rule: user↔provider chat requires an accepted
        // partner request (plus membership for the user side).
        const perm = await checkChatPermission(me, partner);
        if (!perm.allowed) {
            return res.status(perm.statusCode || 403).json({ message: perm.message });
        }

        try {
            const rows = await chatService.getMessages({ senderId: me, partnerId: partner });
            res.json(rows);
        } catch (err) {
            return handleError(res, err);
        }
    }
);

// ── POST /api/provider/messages — send a DM
router.post(
    "/messages",
    authMiddleware,
    roleMiddleware(["user", "provider"]),
    requireFeature("CHAT"),
    async (req, res) => {

        const { receiver_id, message } = req.body;
        if (!receiver_id || !message || !message.trim()) {
            return res.status(400).json({ message: "receiver_id and message are required." });
        }

        // Partner-request chat rule: user↔provider chat requires an accepted
        // partner request (plus membership for the user side).
        const perm = await checkChatPermission(req.user.id, receiver_id);
        if (!perm.allowed) {
            return res.status(perm.statusCode || 403).json({ message: perm.message });
        }

        try {
            const sender_id = req.user.id;
            const inserted = await chatService.sendMessage({
                senderId: sender_id,
                receiverId: receiver_id,
                message: message
            });
            res.status(201).json(inserted);
        } catch (err) {
            return handleError(res, err);
        }
    }
);


// Create Event
router.post(
    "/events",
    authMiddleware,
    roleMiddleware(["provider"]),
    requireFeature("MY_EVENTS"),
    (req, res) => {
        const { title, description, date_time, location, capacity, host_name, entry_fee, application_deadline } = req.body;

        if (!title || !date_time || !location) {
            return res.status(400).json({ message: "Title, date/time, and location are required." });
        }

        if (!host_name || typeof host_name !== 'string' || host_name.trim().length < 1) {
            return res.status(400).json({ message: "host_name is required" });
        }
        if (host_name.trim().length > 150) {
            return res.status(400).json({ message: "host_name must be 150 characters or less" });
        }

        const feeNum = Number(entry_fee);
        if (entry_fee === undefined || entry_fee === null || Number.isNaN(feeNum)) {
            return res.status(400).json({ message: "entry_fee is required" });
        }
        if (feeNum < 0) {
            return res.status(400).json({ message: "entry_fee cannot be negative" });
        }

        if (!application_deadline) {
            return res.status(400).json({ message: "application_deadline is required" });
        }
        const appDeadline = new Date(application_deadline);
        const eventStart = new Date(date_time);
        if (isNaN(appDeadline.getTime()) || isNaN(eventStart.getTime())) {
            return res.status(400).json({ message: "Invalid application_deadline or date_time" });
        }
        if (appDeadline.getTime() >= eventStart.getTime()) {
            return res.status(400).json({ message: "application_deadline must be before the event start time" });
        }

        const creatorId = req.user.id;
        db.query(
            `INSERT INTO events (title, description, date_time, location, capacity, creator_id, host_name, entry_fee, application_deadline) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                title.trim(),
                description ? description.trim() : null,
                date_time,
                location.trim(),
                capacity || 0,
                creatorId,
                host_name.trim(),
                feeNum,
                application_deadline
            ],
            (err, result) => {
                if (err) return handleError(res, err);
                res.status(201).json({
                    id: result.insertId,
                    title,
                    description,
                    date_time,
                    location,
                    capacity: capacity || 0,
                    host_name: host_name,
                    entry_fee: feeNum,
                    application_deadline,
                    creator_id: creatorId,
                    status: 'active'
                });
            }
        );
    }
);


// Edit Event
router.put(
    "/events/:id",
    authMiddleware,
    roleMiddleware(["provider"]),
    (req, res) => {
        const { title, description, date_time, location, capacity, status, host_name, entry_fee, application_deadline } = req.body;
        const eventId = req.params.id;
        const providerId = req.user.id;

        if (!title || !date_time || !location) {
            return res.status(400).json({ message: "Title, date/time, and location are required." });
        }
        if (!host_name || typeof host_name !== 'string' || host_name.trim().length < 1) {
            return res.status(400).json({ message: "host_name is required" });
        }
        if (host_name.trim().length > 150) {
            return res.status(400).json({ message: "host_name must be 150 characters or less" });
        }

        const feeNum = Number(entry_fee);
        if (entry_fee === undefined || entry_fee === null || Number.isNaN(feeNum)) {
            return res.status(400).json({ message: "entry_fee is required" });
        }
        if (feeNum < 0) {
            return res.status(400).json({ message: "entry_fee cannot be negative" });
        }

        if (!application_deadline) {
            return res.status(400).json({ message: "application_deadline is required" });
        }
        const appDeadline = new Date(application_deadline);
        const eventStart = new Date(date_time);
        if (isNaN(appDeadline.getTime()) || isNaN(eventStart.getTime())) {
            return res.status(400).json({ message: "Invalid application_deadline or date_time" });
        }
        if (appDeadline.getTime() >= eventStart.getTime()) {
            return res.status(400).json({ message: "application_deadline must be before the event start time" });
        }

        db.query(
            `UPDATE events SET title = ?, description = ?, date_time = ?, location = ?, capacity = ?, status = ?, host_name = ?, entry_fee = ?, application_deadline = ? WHERE id = ? AND creator_id = ?`,
            [
                title.trim(),
                description ? description.trim() : null,
                date_time,
                location.trim(),
                capacity || 0,
                status || 'active',
                host_name.trim(),
                feeNum,
                application_deadline,
                eventId,
                providerId
            ],
            (err, result) => {
                if (err) return handleError(res, err);
                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: "Event not found or you are not authorized to edit it." });
                }
                res.json({ id: eventId, title, description, date_time, location, capacity, status, host_name, entry_fee: feeNum, application_deadline });
            }
        );
    }
);


// Delete Event
router.delete(
    "/events/:id",
    authMiddleware,
    roleMiddleware(["provider"]),
    (req, res) => {
        const eventId = req.params.id;
        const providerId = req.user.id;

        db.query(
            `DELETE FROM events WHERE id = ? AND creator_id = ?`,
            [eventId, providerId],
            (err, result) => {
                if (err) return handleError(res, err);
                if (result.affectedRows === 0) {
                    return res.status(404).json({ message: "Event not found or you are not authorized to delete it." });
                }
                // also delete participants
                db.query(`DELETE FROM event_participants WHERE event_id = ?`, [eventId]);
                res.json({ message: "Event deleted successfully." });
            }
        );
    }
);

// View Participants
router.get(
    "/events/:id/participants",
    authMiddleware,
    roleMiddleware(["provider"]),
    (req, res) => {
        const eventId = req.params.id;
        db.query(
            `SELECT u.id, u.name, u.email, ep.joined_at 
             FROM event_participants ep 
             JOIN users u ON ep.user_id = u.id 
             WHERE ep.event_id = ?`,
            [eventId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows);
            }
        );
    }
);

// Get all Events ("Browse Events" — requires provider_browse_events)
router.get(
    "/events",
    authMiddleware,
    roleMiddleware(["provider"]),
    requireFeature("BROWSE_EVENTS"),
    (req, res) => {
        db.query(
            `SELECT e.*, 
                    u.name as creator_name,
                    (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) as participant_count
             FROM events e
             JOIN users u ON e.creator_id = u.id
             ORDER BY e.date_time ASC`,
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows);
            }
        );
    }
);

// Get Provider's own Events ("My Events" — requires provider_my_events)
router.get(
    "/events/mine",
    authMiddleware,
    roleMiddleware(["provider"]),
    requireFeature("MY_EVENTS"),
    (req, res) => {
        const providerId = req.user.id;
        db.query(
            `SELECT e.*, 
                    (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) as participant_count,
                    u.name as creator_name
             FROM events e
             JOIN users u ON e.creator_id = u.id
             WHERE e.creator_id = ?
             ORDER BY e.date_time ASC`,
            [providerId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows);
            }
        );
    }
);

// ── POST /api/provider/posts/:id/like — toggle like on a post
router.post(
    "/posts/:id/like",
    authMiddleware,
    roleMiddleware(["user", "provider", "admin"]),
    newsfeedController.toggleLike
);

// ── GET /api/provider/posts/:id/comments — fetch paginated comments
router.get(
    "/posts/:id/comments",
    authMiddleware,
    roleMiddleware(["user", "provider", "admin"]),
    newsfeedController.getComments
);

// ── POST /api/provider/posts/:id/comment — add a comment
router.post(
    "/posts/:id/comment",
    authMiddleware,
    roleMiddleware(["user", "provider", "admin"]),
    newsfeedController.addComment
);

// ── POST /api/provider/posts/:id/share — record a share
router.post(
    "/posts/:id/share",
    authMiddleware,
    roleMiddleware(["user", "provider", "admin"]),
    newsfeedController.sharePost
);

// ── GET /api/provider/packages — public list of provider packages with normalized features
router.get(
    "/packages",
    authMiddleware,
    roleMiddleware(["provider", "admin"]),
    async (req, res) => {
        try {
            const [packages] = await db.query(
                `SELECT id, name, description, price, duration_days, duration_months, tier_type, type, is_active, created_at
                 FROM packages
                 WHERE type = 'provider' AND is_active = 1
                 ORDER BY price ASC`
            );

            if (!packages.length) return res.json([]);

            const packageIds = packages.map(p => p.id);
            const [featureRows] = await db.query(
                `SELECT pf.package_id, f.id AS feature_id, f.feature_key, f.display_name, f.is_coming_soon
                 FROM package_features pf
                 JOIN features f ON f.id = pf.feature_id
                 WHERE pf.package_id IN (?)`,
                [packageIds]
            );

            const featureMap = {};
            for (const row of featureRows) {
                if (!featureMap[row.package_id]) featureMap[row.package_id] = [];
                featureMap[row.package_id].push({
                    id: row.feature_id,
                    key: row.feature_key,
                    display_name: row.display_name,
                    is_coming_soon: Number(row.is_coming_soon) === 1,
                });
            }

            const result = packages.map(pkg => ({
                id: pkg.id,
                name: pkg.name,
                description: pkg.description,
                price: Number(pkg.price),
                duration_days: pkg.duration_days,
                duration_months: pkg.duration_months,
                tier_type: pkg.tier_type,
                type: pkg.type,
                features: featureMap[pkg.id] || [],
            }));

            res.json(result);
        } catch (err) {
            return handleError(res, err);
        }
    }
);

// ── GET /api/provider/featured-profiles ──────────────────────────────────────
// Returns real member (user-role) profiles for the provider's "Featured Profiles"
// section on the dashboard home. Excludes the requesting provider and any
// admin accounts. Sorted by most recently created.
router.get(
    "/featured-profiles",
    authMiddleware,
    roleMiddleware(["provider", "admin"]),
    (req, res) => {
        const providerId = req.user.id;
        db.query(
            `SELECT id, name, avatar_url, profession, location, interests
             FROM users
             WHERE role = 'user'
               AND id != ?
               AND is_active = 1
             ORDER BY created_at DESC
             LIMIT 12`,
            [providerId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows || []);
            }
        );
    }
);

// ── GET /api/provider/featured-locations ─────────────────────────────────────
// Returns distinct event locations (from the events table) for the provider's
// "Featured Locations" section. Each row carries the event count and the next
// upcoming event date for that location.
router.get(
    "/featured-locations",
    authMiddleware,
    roleMiddleware(["provider", "admin"]),
    (req, res) => {
        db.query(
            `SELECT
                location,
                COUNT(*) AS event_count,
                MIN(CASE WHEN date_time >= NOW() THEN date_time END) AS next_event
             FROM events
             WHERE status = 'active' AND location IS NOT NULL AND location != ''
             GROUP BY location
             ORDER BY next_event ASC, event_count DESC
             LIMIT 12`,
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows || []);
            }
        );
    }
);

// ── GET /api/provider/recent-activity ────────────────────────────────────────
// Returns recent activity for the provider dashboard: incoming partner requests,
// event joins, and new chat messages, newest first.
router.get(
    "/recent-activity",
    authMiddleware,
    roleMiddleware(["provider", "admin"]),
    (req, res) => {
        const providerId = req.user.id;
        db.query(
            `(
                SELECT
                    'partner_request' AS type,
                    pr.id,
                    pr.status,
                    pr.created_at,
                    u.name AS counterpart_name,
                    u.avatar_url AS counterpart_avatar,
                    NULL AS detail
                FROM partner_requests pr
                JOIN users u ON u.id = pr.user_id
                WHERE pr.provider_id = ?
                ORDER BY pr.created_at DESC
                LIMIT 5
            )
            UNION ALL
            (
                SELECT
                    'event_join' AS type,
                    ep.event_id AS id,
                    'joined' AS status,
                    ep.joined_at AS created_at,
                    u.name AS counterpart_name,
                    u.avatar_url AS counterpart_avatar,
                    e.title AS detail
                FROM event_participants ep
                JOIN users u ON u.id = ep.user_id
                JOIN events e ON e.id = ep.event_id
                WHERE e.creator_id = ?
                ORDER BY ep.joined_at DESC
                LIMIT 5
            )
            UNION ALL
            (
                SELECT
                    'message' AS type,
                    cm.id,
                    'received' AS status,
                    cm.created_at,
                    u.name AS counterpart_name,
                    u.avatar_url AS counterpart_avatar,
                    cm.message AS detail
                FROM chat_messages cm
                JOIN users u ON u.id = cm.sender_id
                WHERE cm.receiver_id = ?
                ORDER BY cm.created_at DESC
                LIMIT 5
            )
            ORDER BY created_at DESC
            LIMIT 10`,
            [providerId, providerId, providerId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows || []);
            }
        );
    }
);

// ── GET /api/provider/recent-events ──────────────────────────────────────────
// Returns the provider's most recent events (newest created first) for the
// "Recent Activity" section on the provider dashboard home.
router.get(
    "/recent-events",
    authMiddleware,
    roleMiddleware(["provider", "admin"]),
    (req, res) => {
        const providerId = req.user.id;
        db.query(
            `SELECT id, title, description, date_time, location, capacity, status, created_at, host_name, entry_fee
             FROM events
             WHERE creator_id = ?
             ORDER BY created_at DESC
             LIMIT 10`,
            [providerId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows || []);
            }
        );
    }
);

// ── GET /api/provider/list ───────────────────────────────────────────────────
// Returns all provider profiles (id, name, avatar_url, profession, location)
// for the "Models" quick-link on the provider dashboard. Excludes the
// requesting provider and any admin accounts.
router.get(
    "/list",
    authMiddleware,
    roleMiddleware(["provider", "admin"]),
    (req, res) => {
        const providerId = req.user.id;
        db.query(
            `SELECT id, name, avatar_url, profession, location, interests
             FROM users
             WHERE role = 'provider'
               AND id != ?
               AND is_active = 1
             ORDER BY created_at DESC
             LIMIT 50`,
            [providerId],
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows || []);
            }
        );
    }
);

// ── GET /api/provider/all-events ─────────────────────────────────────────────
// Returns all events (with location + date) for the "Places" quick-link on the
// provider dashboard. Each card shows the event location name and date.
router.get(
    "/all-events",
    authMiddleware,
    roleMiddleware(["provider", "admin"]),
    (req, res) => {
        db.query(
            `SELECT id, title, description, date_time, location, capacity, status, created_at, host_name, entry_fee,
                    (SELECT COUNT(*) FROM event_participants WHERE event_id = e.id) as participant_count
             FROM events e
             ORDER BY date_time ASC`,
            (err, rows) => {
                if (err) return handleError(res, err);
                res.json(rows || []);
            }
        );
    }
);

module.exports = router;
