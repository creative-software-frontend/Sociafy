const db = require("../config/db");

const PACKAGE_TIER_TO_ENABLED_FEATURES = {
  starter: [
    // FREE
    "partner_search",
    "chat",
    // but we will treat them as disabled in access mapping for free
  ],
  premium: [
    "partner_search",
    "chat",
  ],
  elite: [
    "partner_search",
    "chat",
    "priority_matching",
    "verified_badge",
    "tour_access",
    // coming soon features are enabled but available=false in middleware
    "audio_call",
    "video_call",
    "advanced_search",
    "vip_support",
  ],
};

function getNow() {
  return new Date();
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + Number(days));
  return d;
}

// Membership hierarchy is fully database-driven via the `membership_level`
// column on the `packages` table. We NEVER compare package id, name, or
// price — those values change when packages are deleted and recreated.
//
//   Silver    -> membership_level = 1
//   Gold      -> membership_level = 2
//   Platinum  -> membership_level = 3
//
// Provider packages reuse the same scale (Starter=1, Premium=2, Elite=3).
// Future packages (Diamond, Enterprise, VIP, ...) simply get a higher
// membership_level value in the database — no backend code changes needed.
//
// A user with NO active membership has level 0 (free), so any real package
// (level >= 1) is treated as an upgrade and is always allowed.

async function getWalletBalanceForUser(connection, userId) {
  const [rows] = await connection.query("SELECT balance FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!rows.length) return null;
  return Number(rows[0].balance || 0);
}

async function buyMembership({ userId, packageId }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Lock user row
    const [userRows] = await connection.query(
      "SELECT id, role, balance, earnings FROM users WHERE id = ? FOR UPDATE",
      [userId]
    );
    if (!userRows.length) {
      const err = new Error("User not found");
      err.statusCode = 404;
      throw err;
    }

    const user = userRows[0];

    // Wallet source for membership purchases.
    // Both USER and PROVIDER fund memberships from `balance`.
    // Provider deposits (and admin-approved deposits) credit `balance`, so this
    // lets providers buy memberships with deposited funds. `earnings` is kept
    // separate and is only used for provider withdrawals.
    const fundsField = 'balance';

    const [pkgRows] = await connection.query(
      "SELECT id, name, price, duration_days, tier_type, membership_level FROM packages WHERE id = ? AND is_active = 1 LIMIT 1 FOR UPDATE",
      [packageId]
    );
    if (!pkgRows.length) {
      const err = new Error("Membership package not found");
      err.statusCode = 404;
      throw err;
    }

    const pkg = pkgRows[0];
    const price = Number(pkg.price || 0);
    const durationDays = Number(pkg.duration_days || 0);
    // Target hierarchy level comes straight from the database.
    const targetLevel = Number(pkg.membership_level || 0);

    const walletBalance = Number(user[fundsField] || 0);

    // ── Membership hierarchy rules ──────────────────────────────────────────
    // Fetch the CURRENT active membership's level from the database only.
    // We compare membership_level values — never id, name, or price.
    const [currentRows] = await connection.query(
      `SELECT COALESCE(p.membership_level, 0) AS current_level
       FROM users u
       LEFT JOIN packages p ON p.id = u.membership_package_id
       WHERE u.id = ? LIMIT 1`,
      [userId]
    );
    const currentLevel = Number(currentRows?.[0]?.current_level || 0);

    // RULE 3 — Lower plan purchase while a higher plan is active => REJECT.
    // Do NOT deduct wallet balance. Do NOT create a transaction.
    if (currentLevel > 0 && targetLevel > 0 && targetLevel < currentLevel) {
      const err = new Error(
        "You already have a higher membership plan active.\n\n" +
        "Please wait for your current membership to expire or cancel it before purchasing a lower plan."
      );
      err.statusCode = 409;
      throw err;
    }

    if (price > 0 && walletBalance < price) {
      const err = new Error("Insufficient wallet balance.");
      err.statusCode = 409;
      throw err;
    }

    // Deduct wallet balance if price > 0
    if (price > 0) {
      await connection.query(`UPDATE users SET ${fundsField} = ${fundsField} - ? WHERE id = ?`, [price, userId]);
    }

    const now = getNow();

    // RULE 1 (same plan) & RULE 2 (higher plan):
    // new_expiration = MAX(current_expiration, NOW()) + duration_days
    // (preserves remaining subscription time on upgrade).
    const [current] = await connection.query(
      "SELECT membership_package_id, membership_expires_at FROM users WHERE id = ? LIMIT 1",
      [userId]
    );

    const currentExpiresAt = current?.[0]?.membership_expires_at ? new Date(current[0].membership_expires_at) : null;
    const baseDate = currentExpiresAt && currentExpiresAt.getTime() > now.getTime() ? currentExpiresAt : now;
    const newExpiresAt = addDays(baseDate, durationDays);

    // Activate membership on user immediately
    await connection.query(
      "UPDATE users SET membership_package_id = ?, membership_started_at = ?, membership_expires_at = ? WHERE id = ?",
      [packageId, now, newExpiresAt, userId]
    );

    // Transaction record (atomic)
    await connection.query(
      `INSERT INTO transactions (user_id, type, amount, status, description)
       VALUES (?, 'membership_purchase', ?, 'completed', ?)` ,
      [userId, -price, `Membership Purchase - ${pkg.tier_type.charAt(0).toUpperCase() + pkg.tier_type.slice(1)} (${fundsField})`]
    );

    // Credit Admin Wallet with the membership price (platform revenue)
    if (price > 0) {
      const adminWalletService = require("../services/adminWalletService");
      await adminWalletService.credit(
        price,
        "membership_income",
        `Membership purchase - ${pkg.name} (user #${userId})`,
        null,
        connection
      );
    }

    await connection.commit();

    // Determine message based on hierarchy relationship (DB-driven levels).
    let message;
    if (currentLevel === 0) {
      message = `You have successfully activated your ${pkg.name} membership.`;
    } else if (currentLevel === targetLevel) {
      message = `Your ${pkg.name} membership has been extended successfully.`;
    } else if (targetLevel > currentLevel) {
      message = `You have successfully upgraded to ${pkg.name} membership.`;
    } else {
      // Should not reach here (lower plan is rejected above), but keep a safe default.
      message = `Membership activated successfully.`;
    }

    return {
      user_id: userId,
      package_id: pkg.id,
      tier_type: pkg.tier_type,
      price,
      funds_source: fundsField,
      membership_started_at: now,
      membership_expires_at: newExpiresAt,
      message,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getMembershipStatus(userId) {
  const [rows] = await db.query(
    "SELECT membership_package_id, membership_started_at, membership_expires_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  if (!rows.length) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  const u = rows[0];

  // NOTE: expiry middleware should already clear expired memberships.
  // Still compute for UI safety.
  const expiresAt = u.membership_expires_at ? new Date(u.membership_expires_at) : null;
  const now = new Date();
  const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() : false;
  const days_remaining = !expiresAt || isExpired ? 0 : Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));


  if (!u.membership_package_id || !u.membership_expires_at || isExpired) {
    return {
      plan: "free",
      expires_at: null,
      days_remaining: 0,
      wallet_balance: null,
      features: {
        partner_search: { enabled: false, available: false, message: "Locked" },
        chat: { enabled: false, available: false, message: "Locked" },
        audio_call: { enabled: false, available: false, message: "Locked" },
        video_call: { enabled: false, available: false, message: "Locked" },
        advanced_search: { enabled: false, available: false, message: "Locked" },
        vip_support: { enabled: false, available: false, message: "Locked" },
        priority_matching: { enabled: false, available: false, message: "Locked" },
        verified_badge: { enabled: false, available: false, message: "Locked" },
        tour_access: { enabled: false, available: false, message: "Locked" },
      }
    };
  }

  const [pkgRows] = await db.query(
    "SELECT id, tier_type, price, duration_days FROM packages WHERE id = ? LIMIT 1",
    [u.membership_package_id]
  );

  const pkg = pkgRows?.[0];
  const tier = pkg?.tier_type || "starter";

  // UI contract required by task: features.<name> = { enabled, available, message }
  const wallet_balance = await db.query("SELECT balance FROM users WHERE id = ? LIMIT 1", [userId]).then(r => r?.[0]?.[0]?.balance ?? 0);

  const plan = pkg?.name || tier;

  // DB-driven features: membership enabled features come from package_features.
  // Availability/coming-soon comes from features.is_coming_soon.
  const [featureRows] = await db.query(
    `SELECT f.feature_key, f.display_name, f.is_coming_soon
     FROM package_features pf
     JOIN features f ON f.id = pf.feature_id
     WHERE pf.package_id = ?`,
    [u.membership_package_id]
  );

  const features = {};
  for (const row of featureRows) {
    const key = row.feature_key;
    const isCS = Number(row.is_coming_soon) === 1;
    features[key] = isCS
      ? { enabled: true, available: false, message: "Coming Soon" }
      : { enabled: true, available: true, message: "Enabled" };
  }

  return {
    plan,
    expires_at: u.membership_expires_at,
    days_remaining,
    wallet_balance: Number(wallet_balance),
    features,
  };
}

async function getCurrentMembership(userId) {
  const [userRows] = await db.query(
    "SELECT membership_package_id, membership_expires_at FROM users WHERE id = ? LIMIT 1",
    [userId]
  );

  if (!userRows.length) {
    const err = new Error("User not found");
    err.statusCode = 404;
    throw err;
  }

  const u = userRows[0];
  const expiresAt = u.membership_expires_at ? new Date(u.membership_expires_at) : null;
  const now = new Date();
  const isExpired = expiresAt ? expiresAt.getTime() < now.getTime() : false;

  let pkgName = "Free";
  let tierType = null;
  let features = [];

  if (u.membership_package_id && !isExpired) {
    const [pkgRows] = await db.query(
      "SELECT tier_type, name FROM packages WHERE id = ? LIMIT 1",
      [u.membership_package_id]
    );

    if (pkgRows.length) {
      tierType = pkgRows[0].tier_type;
      pkgName = pkgRows[0].name || tierType;
    }

    // Query normalized package_features: package_id -> feature_id -> feature_key
    const [pfRows] = await db.query(
      `SELECT f.feature_key, f.display_name
       FROM package_features pf
       JOIN features f ON f.id = pf.feature_id
       WHERE pf.package_id = ?`,
      [u.membership_package_id]
    );
    features = pfRows.map(row => row.feature_key);

    // DB-driven display names for the active features. The UI must NOT
    // hardcode feature labels — they come straight from the `features`
    // table (display_name column). This keeps provider/user feature labels
    // in sync with the database regardless of package or tier changes.
    const features_display = pfRows.map(row => row.display_name || row.feature_key);
  } else {
    // No active membership — expose an empty display list for safety.
    var features_display = [];
  }

  return {
    package: pkgName,
    expires_at: isExpired ? null : u.membership_expires_at,
    features: features,
    features_display: features_display
  };
}

async function normalizePackagesWithFeatures({ packages }) {
  if (!packages.length) return [];

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

  return packages.map(pkg => (
    {
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      price: Number(pkg.price),
      duration_days: pkg.duration_days,
      duration_months: pkg.duration_months,
      tier_type: pkg.tier_type,
      type: pkg.type,
      features: featureMap[pkg.id] || [],
    }
  ));
}

async function getUserPackages() {
  const [packages] = await db.query(
    `SELECT id, name, description, price, duration_days, duration_months, tier_type, type, is_active, created_at
     FROM packages
     WHERE type = 'user' AND is_active = 1
     ORDER BY price ASC
  `);

  console.log("[DB RESULT USER]", packages);
  return normalizePackagesWithFeatures({ packages });
}

async function getProviderPackages() {
  const [packages] = await db.query(
    `SELECT id, name, description, price, duration_days, duration_months, tier_type, type, is_active, created_at
     FROM packages
     WHERE type = 'provider' AND is_active = 1
     ORDER BY price ASC
  `);

  console.log("[DB RESULT PROVIDER]", packages);
  return normalizePackagesWithFeatures({ packages });
}

// New cancellation function
async function cancelMembership({ userId }) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();

    // Update user membership to free
    await connection.query(
      "UPDATE users SET membership_package_id = NULL, membership_started_at = NULL, membership_expires_at = NULL WHERE id = ?",
      [userId]
    );

    await connection.commit();

    return {
      success: true,
      message: "Membership canceled successfully"
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  buyMembership,
  getMembershipStatus,
  getCurrentMembership,
  getUserPackages,
  getProviderPackages,
  cancelMembership
};