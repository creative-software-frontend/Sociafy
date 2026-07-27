const db = require("../config/db");

// Map the UI/middleware feature aliases to the canonical feature_key values
// stored in the `features` table. The DB uses lowercase, scoped keys
// (e.g. "basic_chat", "partner_search") while some call sites pass the
// legacy uppercase names (e.g. "CHAT", "PARTNER_SEARCH").
//
// Provider feature keys are prefixed with "provider_" (e.g. "provider_chat")
// to keep them isolated from user feature keys. The alias map below maps the
// shared call-site names to the correct scoped key based on the requesting
// user's role, so the same `requireFeature("CHAT")` works for both users and
// providers without hardcoding package names anywhere.
const USER_FEATURE_ALIASES = {
  CHAT: "basic_chat",
  PARTNER_SEARCH: "partner_search",
  ADVANCED_SEARCH: "advanced_search_filter",
  EVENT_ACCESS: "tour_access",
  AUDIO_CALL: "audio_call",
};

const PROVIDER_FEATURE_ALIASES = {
  CHAT: "provider_chat",
  BROWSE_EVENTS: "provider_browse_events",
  MY_EVENTS: "provider_my_events",
  AUDIO_CALL: "provider_audio_call",
  VIDEO_CALL: "provider_video_call",
  VERIFIED_BADGE: "provider_verified_badge",
  PRIORITY_MATCHING: "provider_priority_matching",
  VIP_SUPPORT: "provider_vip_support",
  EVENT_ACCESS: "provider_browse_events",
};

function normalizeFeatureName(featureName, role) {
  if (!featureName) return null;
  const s = String(featureName).trim();
  if (!s) return null;
  if (role === "provider") return PROVIDER_FEATURE_ALIASES[s] || s;
  return USER_FEATURE_ALIASES[s] || s;
}

function membershipNoMembership() {
  return { statusCode: 403, message: "This feature requires membership" };
}

function membershipExpired() {
  return { statusCode: 403, message: "Membership expired" };
}

function membershipLocked() {
  return { statusCode: 403, message: "Upgrade membership to access this feature" };
}

async function checkFeatureAccess(userId, featureName, role) {
  const f = normalizeFeatureName(featureName, role);
  if (!f) return { allowed: false, ...membershipLocked() };

  // Load membership
  const [userRows] = await db.query(
    "SELECT membership_package_id, membership_expires_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  if (!userRows || userRows.length === 0) return { allowed: false, ...membershipNoMembership() };
  const u = userRows[0];

  if (!u.membership_package_id || !u.membership_expires_at) {
    return { allowed: false, ...membershipNoMembership() };
  }

  const expiresAt = new Date(u.membership_expires_at);
  const now = new Date();
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() < now.getTime()) {
    return { allowed: false, ...membershipExpired() };
  }

  // Get current package tier_type
  const [pkgRows] = await db.query(
    "SELECT tier_type FROM packages WHERE id = ? AND is_active = 1 LIMIT 1",
    [u.membership_package_id]
  );

  const tierType = pkgRows?.[0]?.tier_type ? String(pkgRows[0].tier_type) : null;
  if (!tierType) return { allowed: false, ...membershipLocked() };

  // Feature key must match DB features.feature_key exactly.
  // Normalization is limited to trimming only.
  const dbFeatureKey = f;




  // DB-driven: check whether this feature is enabled for the user's selected package.
  const [pfRows] = await db.query(
    `SELECT 1
     FROM package_features pf
     JOIN features f ON f.id = pf.feature_id
     WHERE pf.package_id = ?
       AND f.feature_key = ?
     LIMIT 1`,
    [u.membership_package_id, dbFeatureKey]
  );

  return pfRows && pfRows.length ? { allowed: true } : { allowed: false, ...membershipLocked() };
}

function requireFeature(featureName) {
  const f = normalizeFeatureName(featureName);
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Unauthorized" });

      // Admins bypass all membership checks.
      if (req.user?.role === "admin") return next();

      // Both users and providers are subject to membership feature gating.
      // Access is determined purely by the active membership's package_features
      // (DB-driven) — never by hardcoding package names.
      const result = await checkFeatureAccess(userId, f, req.user?.role);
      if (!result.allowed) {
        return res.status(result.statusCode || 403).json({ message: result.message });
      }

      return next();
    } catch (err) {
      return res.status(500).json({ message: err.message || "Membership check failed" });
    }
  };
}

/**
 * Middleware to fallback expired memberships to FREE on every request.
 */
async function membershipExpiryMiddleware(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) return next();

    const [rows] = await db.query(
      "SELECT membership_package_id, membership_expires_at FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    if (!rows || rows.length === 0) return next();

    const u = rows[0];
    if (!u.membership_package_id || !u.membership_expires_at) return next();

    const expiresAt = new Date(u.membership_expires_at);
    const now = new Date();

    if (Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < now.getTime()) {
      await db.query(
        "UPDATE users SET membership_package_id = NULL, membership_started_at = NULL, membership_expires_at = NULL WHERE id = ?",
        [userId]
      );
    }

    return next();
  } catch (err) {
    return next();
  }
}

module.exports = {
  checkFeatureAccess,
  requireFeature,
  membershipExpiryMiddleware,
};



