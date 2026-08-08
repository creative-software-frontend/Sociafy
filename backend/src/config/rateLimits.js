/**
 * Central rate-limit configuration.
 *
 * Express limiters use express-rate-limit (in-memory store; use Redis for
 * multi-instance deployments). Identity is the authenticated user ID when
 * available, otherwise the client IP. Socket.IO uses a small in-memory windowed
 * limiter per user and emits a safe error event instead of disconnecting.
 */

const { rateLimit, ipKeyGenerator } = require("express-rate-limit");

const MESSAGE = "Too many requests. Please try again later.";

function keyGenerator(req) {
    if (req.user && req.user.id) return `u:${req.user.id}`;
    // Normalize IPv6 via the package's helper so limits work reliably on IPv6.
    return `ip:${ipKeyGenerator(req.ip)}`;
}

function makeLimiter({ windowMs, limit, keyGeneratorFn = keyGenerator }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: keyGeneratorFn,
        handler: (req, res) => res.status(429).json({ message: MESSAGE }),
    });
}

/* ── Public endpoints (IP-based) ── */
const authLoginLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 10 });
const authRegisterLimiter = makeLimiter({ windowMs: 60 * 60 * 1000, limit: 5 });

/* ── Security-sensitive (authenticated user) ── */
const passwordChangeLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 5 });

/* ── Financial mutations (authenticated user) ── */
const financialLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 30 });
const withdrawLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 10 });
const membershipLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 10 });
const giftHttpLimiter = makeLimiter({ windowMs: 60 * 1000, limit: 30 });
const adminWalletLimiter = makeLimiter({ windowMs: 15 * 60 * 1000, limit: 30 });

/* ── Socket.IO windowed limiter (per user) ── */
function createSocketLimiter({ windowMs, max, scope }) {
    const hits = new Map();
    return (userId, sub = "") => {
        const key = `${scope}:${userId}:${sub}`;
        const now = Date.now();
        const rec = hits.get(key);
        if (!rec || rec.resetAt <= now) {
            hits.set(key, { count: 1, resetAt: now + windowMs });
            return { allowed: true };
        }
        rec.count += 1;
        if (rec.count > max) {
            return { allowed: false, retryAfterMs: rec.resetAt - now };
        }
        return { allowed: true };
    };
}

module.exports = {
    authLoginLimiter,
    authRegisterLimiter,
    passwordChangeLimiter,
    financialLimiter,
    withdrawLimiter,
    membershipLimiter,
    giftHttpLimiter,
    adminWalletLimiter,
    createSocketLimiter,
    MESSAGE,
};
