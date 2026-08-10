/**
 * Production-readiness security tests for the dedicated admin auth system.
 *
 * The production MySQL database (mysql.railway.internal) is NOT reachable from
 * this machine, so these tests run against the real Express routes / middleware
 * / controllers with a stubbed `db` module injected via `require.cache`. Every
 * DB interaction is mocked. Tests are labelled MOCKED accordingly.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const http = require("http");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const express = require("express");

process.env.JWT_SECRET = "test-secret-for-admin-auth-suite-0123456789";

/* ── Stubbed in-memory users table ─────────────────────────────────────── */
const ADMIN_PASSWORD = "AdminPassw0rd!12345";
const USER_PASSWORD = "UserPassw0rd!12345";
const NEW_ADMIN_PASSWORD = "AdminNewPassw0rd!54321";
const VERSION_ADMIN_PASSWORD = "VersionAdminPassw0rd!123";
const VERSION_ADMIN_NEW_PASSWORD = "VersionAdminPassw0rd!456";

let users = [];

// Setup availability is driven purely by the live admin count (exactly zero or
// one admin). These helpers let the setup lifecycle tests model the real
// zero-admin / one-admin / admin-deleted transitions directly on the array.

function adminRows() {
    return users.filter((u) => u.role === "admin");
}

function removeAllAdmins() {
    users = users.filter((u) => u.role !== "admin");
}

/* ── In-memory DB stub (supports promise + callback styles) ────────────── */
function pickListFields(u) {
    return {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        is_active: u.is_active,
        created_at: u.created_at,
    };
}

function route(sql, values) {
    const S = String(sql);

    if (/^update users set password/i.test(S)) {
        const [hash, id] = values;
        const u = users.find((x) => Number(x.id) === Number(id));
        if (u) {
            u.password = hash;
            u.token_version = Number(u.token_version || 0) + 1;
        }
        return [];
    }
    if (/^update users set token_version = token_version \+ 1/i.test(S)) {
        const id = values[0];
        const u = users.find((x) => Number(x.id) === Number(id));
        if (u) u.token_version = Number(u.token_version || 0) + 1;
        return [];
    }
    if (/^update users/i.test(S)) return []; // presence etc.

    if (/select count\(\*\)\s+as\s+totalusers/i.test(S)) {
        return [{ totalUsers: users.filter((u) => u.role === "user").length }];
    }
    if (/select count\(\*\)\s+as\s+totalproviders/i.test(S)) {
        return [{ totalProviders: users.filter((u) => u.role === "provider").length }];
    }
    if (/select count\(\*\)\s+as\s+total/i.test(S)) {
        return [{ total: 0 }];
    }

    if (/from users where role='user' order by created_at desc/i.test(S)) {
        return users.filter((u) => u.role === "user").map(pickListFields);
    }
    if (/from users where role='provider' order by created_at desc/i.test(S)) {
        return users.filter((u) => u.role === "provider").map(pickListFields);
    }

    if (/select membership_package_id, membership_expires_at from users where id = \? limit 1/i.test(S)) {
        const u = users.find((x) => Number(x.id) === Number(values[0]));
        return u
            ? [{ membership_package_id: u.membership_package_id || null, membership_expires_at: u.membership_expires_at || null }]
            : [];
    }

    if (/select id, name, email, role, is_active, token_version from users where id = \? limit 1/i.test(S)) {
        const u = users.find((x) => Number(x.id) === Number(values[0]));
        return u
            ? [{ id: u.id, name: u.name, email: u.email, role: u.role, is_active: u.is_active, token_version: Number(u.token_version || 0) }]
            : [];
    }

    if (/select password from users where id = \? limit 1/i.test(S)) {
        const u = users.find((x) => Number(x.id) === Number(values[0]));
        return u ? [{ password: u.password }] : [];
    }

    // Dedicated admin login lookup
    if (/from users where email = \? limit 1/i.test(S)) {
        const u = users.find((x) => x.email === values[0]);
        return u ? [u] : [];
    }

    // roleMiddleware
    if (/select role, is_active from users where id = \?/i.test(S)) {
        const u = users.find((x) => Number(x.id) === Number(values[0]));
        return u ? [{ role: u.role, is_active: u.is_active }] : [];
    }

    // Normal authController login lookup
    if (/select \* from users where email = \?/i.test(S)) {
        const u = users.find((x) => x.email === values[0]);
        return u ? [u] : [];
    }

    // ── First-admin setup (authoritative state = live admin count) ────
    if (/select id from users where role = 'admin' limit 1/i.test(S)) {
        const admin = adminRows()[0];
        return admin ? [{ id: admin.id }] : [];
    }

    // ── Admin self-deletion ─────────────────────────────────────────────
    if (/select id, password, role, is_active from users where id = \? limit 1/i.test(S)) {
        const u = users.find((x) => Number(x.id) === Number(values[0]));
        return u
            ? [{ id: u.id, password: u.password, role: u.role, is_active: u.is_active }]
            : [];
    }
    if (/^delete from users where id = \? and role = 'admin'/i.test(S)) {
        const id = values[0];
        const before = users.length;
        users = users.filter((x) => !(Number(x.id) === Number(id) && x.role === "admin"));
        // mysql2 returns a ResultSetHeader object (not an array) for DELETEs.
        return { affectedRows: before - users.length };
    }

    if (/^insert into users/i.test(S)) {
        const [name, email, phone, password] = values;
        const id = users.length ? Math.max(...users.map((u) => u.id)) + 1 : 1;
        users.push({
            id,
            name,
            email,
            phone,
            role: "admin",
            is_active: 1,
            token_version: 0,
            password,
            created_at: new Date().toISOString().slice(0, 19).replace("T", " "),
        });
        // mysql2 returns a ResultSetHeader object (not an array) for INSERTs.
        return { insertId: id, affectedRows: 1 };
    }

    return [];
}

// ── Transaction + row-lock emulation ────────────────────────────────────
// The setup controller serializes concurrent requests by taking a row lock on
// the single platform_settings row (SELECT ... FOR UPDATE). This mutex models
// that: the first transaction to hit the FOR UPDATE query holds a queue
// position, and the next setup transaction cannot proceed until the holder
// commits/rolls back — exactly like InnoDB's row lock.
let setupLockChain = Promise.resolve();

function acquireSetupLock() {
    const prev = setupLockChain;
    let release;
    setupLockChain = new Promise((resolve) => { release = resolve; });
    return prev.then(() => release);
}

function makeConnection() {
    const conn = {
        _lockRelease: null,
        beginTransaction() {
            return Promise.resolve();
        },
        query(sql, values, callback) {
            if (typeof values === "function") {
                callback = values;
                values = undefined;
            }
            const run = async () => {
                if (/for update/i.test(String(sql))) {
                    conn._lockRelease = await acquireSetupLock();
                }
                const rows = route(sql, values || []);
                if (typeof callback === "function") {
                    callback(null, rows);
                    return conn;
                }
                return [rows, []];
            };
            if (typeof callback === "function") {
                run().catch((err) => callback(err));
                return conn;
            }
            return run();
        },
        commit() {
            if (conn._lockRelease) { conn._lockRelease(); conn._lockRelease = null; }
            return Promise.resolve();
        },
        rollback() {
            if (conn._lockRelease) { conn._lockRelease(); conn._lockRelease = null; }
            return Promise.resolve();
        },
        release() {
            if (conn._lockRelease) { conn._lockRelease(); conn._lockRelease = null; }
            return Promise.resolve();
        },
    };
    return conn;
}

const stubDb = {
    query(sql, values, callback) {
        if (typeof values === "function") {
            callback = values;
            values = undefined;
        }
        const rows = route(sql, values || []);
        if (typeof callback === "function") {
            callback(null, rows);
            return {};
        }
        return Promise.resolve([rows, []]);
    },
    getConnection() {
        return Promise.resolve(makeConnection());
    },
};

// Inject the stub BEFORE requiring any route/controller that loads ../config/db.
const dbModulePath = require.resolve("../src/config/db.js");
require.cache[dbModulePath] = { id: dbModulePath, filename: dbModulePath, loaded: true, exports: stubDb };

// The IP-based setup limiter would otherwise block the mocked setup flow (all
// test traffic shares one IP). Bypass only the setup + account-delete limiters;
// the real login limiter stays active so the rate-limit test below still
// exercises it (it can be reset between sections via resetKey).
const realRateLimits = require("../src/config/rateLimits");
const rateLimitsPath = require.resolve("../src/config/rateLimits.js");
const bypassLimiter = (req, res, next) => next();
require.cache[rateLimitsPath] = {
    id: rateLimitsPath,
    filename: rateLimitsPath,
    loaded: true,
    exports: {
        ...realRateLimits,
        adminSetupLimiter: bypassLimiter,
        adminAccountDeleteLimiter: bypassLimiter,
    },
};

/* ── Build the real app on the real routes ─────────────────────────────── */
const app = express();
app.use(express.json());
app.use("/api/auth", require("../src/routes/authRoutes"));
app.use("/api/admin/auth", require("../src/routes/adminAuthRoutes"));
app.use("/api/admin", require("../src/routes/adminRoutes"));
app.use((req, res) => res.status(404).json({ message: "Route not found" }));

let server;
let base;

const before = test.before;
const after = test.after;

before(async () => {
    users.push(
        {
            id: 1,
            name: "Root Admin",
            email: "admin@bluedise.test",
            phone: "8801700000001",
            role: "admin",
            is_active: 1,
            token_version: 0,
            membership_package_id: null,
            membership_expires_at: null,
            password: await bcrypt.hash(ADMIN_PASSWORD, 4),
            created_at: "2024-01-01 00:00:00",
        },
        {
            id: 2,
            name: "Blocked Admin",
            email: "blocked@bluedise.test",
            phone: "8801700000002",
            role: "admin",
            is_active: 0,
            token_version: 0,
            membership_package_id: null,
            membership_expires_at: null,
            password: await bcrypt.hash(ADMIN_PASSWORD, 4),
            created_at: "2024-01-02 00:00:00",
        },
        {
            id: 3,
            name: "Normal User",
            email: "user@bluedise.test",
            phone: "8801700000003",
            role: "user",
            is_active: 1,
            token_version: 0,
            membership_package_id: null,
            membership_expires_at: null,
            password: await bcrypt.hash(USER_PASSWORD, 4),
            created_at: "2024-01-03 00:00:00",
        },
        {
            id: 4,
            name: "Version Admin",
            email: "version-admin@bluedise.test",
            phone: "8801700000004",
            role: "admin",
            is_active: 1,
            token_version: 0,
            membership_package_id: null,
            membership_expires_at: null,
            password: await bcrypt.hash(VERSION_ADMIN_PASSWORD, 4),
            created_at: "2024-01-04 00:00:00",
        }
    );

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
});

async function call(method, urlPath, { token, body } = {}) {
    const res = await fetch(`${base}${urlPath}`, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { "Content-Type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try {
        json = await res.json();
    } catch (_) {
        /* no body */
    }
    return { status: res.status, json };
}

function sign(id, role, secret, tokenVersion) {
    let v = tokenVersion;
    if (v === undefined) {
        const u = users.find((x) => Number(x.id) === Number(id));
        v = u ? Number(u.token_version || 0) : undefined;
    }
    const payload = { id, role };
    if (v !== undefined) payload.token_version = v;
    return jwt.sign(payload, secret || process.env.JWT_SECRET, { expiresIn: "1h" });
}

/* ══ 1. Dedicated admin login (MOCKED DB) ══ */

test("admin login succeeds with valid credentials and returns no secrets", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "admin@bluedise.test", password: ADMIN_PASSWORD },
    });

    assert.equal(status, 200);
    assert.equal(json.role, "admin");
    assert.equal(json.id, 1);
    assert.equal(json.name, "Root Admin");
    assert.equal(json.email, "admin@bluedise.test");
    assert.ok(json.token, "token expected");
    assert.ok(json.token.split(".").length === 3, "token should be a JWT");
    assert.ok(!("password" in json), "password must never be returned");
    assert.ok(!("phone" in json), "phone must never be returned from admin login");
});

test("admin login rejects a wrong password", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "admin@bluedise.test", password: "WrongPassword!9999" },
    });
    assert.equal(status, 400);
    assert.equal(json.message, "Invalid credentials");
});

test("admin login returns a generic error for a nonexistent account (no enumeration)", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "nobody@bluedise.test", password: ADMIN_PASSWORD },
    });
    assert.equal(status, 400);
    assert.equal(json.message, "Invalid credentials");
});

test("admin login rejects a normal user even with a correct password", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "user@bluedise.test", password: USER_PASSWORD },
    });
    assert.equal(status, 403);
    assert.equal(json.message, "Admin access required");
});

test("admin login rejects an inactive admin even with a correct password", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "blocked@bluedise.test", password: ADMIN_PASSWORD },
    });
    assert.equal(status, 403);
    assert.equal(json.message, "Your account is blocked by the administrator.");
});

test("admin login requires both email and password", async () => {
    const { status } = await call("POST", "/api/admin/auth/login", {
        body: { email: "admin@bluedise.test" },
    });
    assert.equal(status, 400);
});

/* ══ 2. /api/admin/auth/me ══ */

test("me returns the admin profile with a valid admin token", async () => {
    const adminToken = sign(1, "admin");
    const { status, json } = await call("GET", "/api/admin/auth/me", { token: adminToken });
    assert.equal(status, 200);
    assert.deepEqual(
        { id: json.id, name: json.name, email: json.email, role: json.role },
        { id: 1, name: "Root Admin", email: "admin@bluedise.test", role: "admin" }
    );
    assert.ok(!("password" in json), "me must not return password");
});

test("me rejects a normal user token", async () => {
    const userToken = sign(3, "user");
    const { status, json } = await call("GET", "/api/admin/auth/me", { token: userToken });
    assert.equal(status, 403);
    assert.equal(json.message, "Admin access required");
});

test("me rejects a request with no token", async () => {
    const { status, json } = await call("GET", "/api/admin/auth/me");
    assert.equal(status, 401);
    assert.equal(json.message, "No token provided");
});

test("me rejects a forged / invalid token", async () => {
    const forged = sign(1, "admin", "wrong-secret");
    const { status, json } = await call("GET", "/api/admin/auth/me", { token: forged });
    assert.equal(status, 401);
    assert.equal(json.message, "Token invalid or expired");
});

/* ══ 3. Existing admin API endpoint stays protected (real adminRoutes) ══ */

test("existing /api/admin/users-summary allows an admin token", async () => {
    const adminToken = sign(1, "admin");
    const { status, json } = await call("GET", "/api/admin/users-summary", { token: adminToken });
    assert.equal(status, 200);
    assert.equal(json.totalUsers, 1);
    assert.equal(json.totalProviders, 0);
    assert.ok(Array.isArray(json.users));
});

test("existing /api/admin/users-summary rejects a normal user token", async () => {
    const userToken = sign(3, "user");
    const { status, json } = await call("GET", "/api/admin/users-summary", { token: userToken });
    assert.equal(status, 403);
    assert.equal(json.message, "Access denied");
});

test("existing /api/admin/users-summary rejects a request with no token", async () => {
    const { status, json } = await call("GET", "/api/admin/users-summary");
    assert.equal(status, 401);
    assert.equal(json.message, "No token provided");
});

/* ══ 4. change-password ══ */

test("change-password succeeds with correct current password", async () => {
    const adminToken = sign(1, "admin");
    const { status, json } = await call("POST", "/api/admin/auth/change-password", {
        token: adminToken,
        body: { currentPassword: ADMIN_PASSWORD, newPassword: NEW_ADMIN_PASSWORD },
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
});

test("change-password rejects a wrong current password", async () => {
    const adminToken = sign(1, "admin");
    const { status, json } = await call("POST", "/api/admin/auth/change-password", {
        token: adminToken,
        body: { currentPassword: "TotallyWrongPass1!", newPassword: "SomeOtherPassw0rd!123" },
    });
    assert.equal(status, 400);
    assert.equal(json.message, "Current password is incorrect.");
});

test("change-password rejects a too-short new password", async () => {
    const adminToken = sign(1, "admin");
    const { status, json } = await call("POST", "/api/admin/auth/change-password", {
        token: adminToken,
        body: { currentPassword: ADMIN_PASSWORD, newPassword: "short" },
    });
    assert.equal(status, 400);
    assert.match(json.message, /at least 16 characters/);
});

test("change-password rejects new password identical to current", async () => {
    const adminToken = sign(1, "admin");
    const { status, json } = await call("POST", "/api/admin/auth/change-password", {
        token: adminToken,
        body: { currentPassword: ADMIN_PASSWORD, newPassword: ADMIN_PASSWORD },
    });
    assert.equal(status, 400);
    assert.equal(json.message, "New password must be different from your current password.");
});

test("change-password rejects a normal user token", async () => {
    const userToken = sign(3, "user");
    const { status, json } = await call("POST", "/api/admin/auth/change-password", {
        token: userToken,
        body: { currentPassword: USER_PASSWORD, newPassword: NEW_ADMIN_PASSWORD },
    });
    assert.equal(status, 403);
    assert.equal(json.message, "Admin access required");
});

test("change-password rejects a request with no token", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/change-password", {
        body: { currentPassword: ADMIN_PASSWORD, newPassword: NEW_ADMIN_PASSWORD },
    });
    assert.equal(status, 401);
    assert.equal(json.message, "No token provided");
});

/* ══ 5. Password actually changed (proves DB update) ══ */

test("old password no longer works after change (MOCKED DB)", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "admin@bluedise.test", password: ADMIN_PASSWORD },
    });
    assert.equal(status, 400);
    assert.equal(json.message, "Invalid credentials");
});

test("new password works after change (MOCKED DB)", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "admin@bluedise.test", password: NEW_ADMIN_PASSWORD },
    });
    assert.equal(status, 200);
    assert.equal(json.role, "admin");
    assert.ok(json.token);
});

/* ══ 6. Logout (stateless ack) ══ */

test("logout returns a success acknowledgement for an admin token", async () => {
    const adminToken = sign(1, "admin");
    const { status, json } = await call("POST", "/api/admin/auth/logout", { token: adminToken });
    assert.equal(status, 200);
    assert.equal(json.success, true);
});

/* ══ 7. Normal auth flow regression (unchanged) ══ */

test("normal /api/auth/login still works for a normal user", async () => {
    const { status, json } = await call("POST", "/api/auth/login", {
        body: { email: "user@bluedise.test", password: USER_PASSWORD },
    });
    assert.equal(status, 200);
    assert.equal(json.role, "user");
    assert.ok(json.token);
    assert.ok(json.referralLink, "referral link should still be generated");
});

test("normal /api/auth/login rejects an admin account (portal redirect)", async () => {
    const { status, json } = await call("POST", "/api/auth/login", {
        body: { email: "admin@bluedise.test", password: NEW_ADMIN_PASSWORD },
    });
    assert.equal(status, 403);
    assert.equal(json.message, "Please use the admin login portal.");
});

/* ══ 7b. Server-side token_version invalidation (MOCKED DB) ══ */

test("a newly issued admin token works (token_version embedded and accepted)", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "version-admin@bluedise.test", password: VERSION_ADMIN_PASSWORD },
    });
    assert.equal(status, 200);
    const decoded = jwt.decode(json.token);
    assert.equal(decoded.token_version, 0, "new token should carry current token_version");

    const me = await call("GET", "/api/admin/auth/me", { token: json.token });
    assert.equal(me.status, 200);
});

test("an old token works before a password change (version matches)", async () => {
    // Current DB version is still 0, so a v0 token is accepted.
    const oldToken = sign(4, "admin", undefined, 0);
    const me = await call("GET", "/api/admin/auth/me", { token: oldToken });
    assert.equal(me.status, 200);
});

test("changing the password increments token_version (MOCKED DB)", async () => {
    const adminToken = sign(4, "admin");
    const { status, json } = await call("POST", "/api/admin/auth/change-password", {
        token: adminToken,
        body: { currentPassword: VERSION_ADMIN_PASSWORD, newPassword: VERSION_ADMIN_NEW_PASSWORD },
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    const stored = users.find((u) => Number(u.id) === 4);
    assert.equal(Number(stored.token_version), 1, "token_version must be incremented to 1");
});

test("an old token is rejected after a password change (stale version)", async () => {
    const staleToken = sign(4, "admin", undefined, 0);
    const me = await call("GET", "/api/admin/auth/me", { token: staleToken });
    assert.equal(me.status, 401);
    assert.equal(me.json.message, "Session expired. Please sign in again.");
});

test("a newly issued token after a password change works (new version)", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "version-admin@bluedise.test", password: VERSION_ADMIN_NEW_PASSWORD },
    });
    assert.equal(status, 200);
    const decoded = jwt.decode(json.token);
    assert.equal(decoded.token_version, 1, "re-issued token should carry incremented version");

    const me = await call("GET", "/api/admin/auth/me", { token: json.token });
    assert.equal(me.status, 200);
});

test("normal user authentication remains functional (no version gating)", async () => {
    // The real generateToken only embeds token_version when an admin passes it;
    // a normal-user token from the real login flow carries no version claim and
    // is unaffected by admin session invalidation.
    const { status, json } = await call("POST", "/api/auth/login", {
        body: { email: "user@bluedise.test", password: USER_PASSWORD },
    });
    assert.equal(status, 200);
    const decoded = jwt.decode(json.token);
    assert.ok(!("token_version" in decoded), "normal-user tokens should not embed a version");
});

/* ══ 8. Admin login rate limiting (MOCKED, in-memory limiter) ══ */

test("admin login endpoint rate-limits after 10 attempts per window", async () => {
    const statuses = [];
    for (let i = 0; i < 8; i += 1) {
        const { status } = await call("POST", "/api/admin/auth/login", {
            body: { email: "admin@bluedise.test", password: "WrongPassword!9999" },
        });
        statuses.push(status);
    }
    // 10 successful/failed login attempts were consumed by earlier tests; this
    // batch pushes past the limit of 10, so the tail of the batch must be 429.
    assert.ok(statuses.some((s) => s === 429), "expected at least one 429 in the batch");
    assert.equal(statuses[statuses.length - 1], 429, "the final attempt should be rate-limited");
});

/* ══ 9. First-admin setup lifecycle (MOCKED DB) ══
   Setup availability is driven by the LIVE admin count, never by a flag:
   zero admins → available, one admin → unavailable, admin deleted →
   available again (no manual SQL reset). */

test("setup-status: one admin exists → setup unavailable", async () => {
    // Seed admins (Root Admin, Blocked Admin, Version Admin) are loaded.
    assert.ok(adminRows().length >= 1, "seed admins must be present for this test");
    const { status, json } = await call("GET", "/api/admin/auth/setup-status");
    assert.equal(status, 200);
    assert.equal(json.setup_available, false);
});

test("setup-status: zero admins → setup available", async () => {
    removeAllAdmins();
    assert.equal(adminRows().length, 0);
    const { status, json } = await call("GET", "/api/admin/auth/setup-status");
    assert.equal(status, 200);
    assert.equal(json.setup_available, true);
});

test("setup creates the first admin and setup becomes locked (MOCKED DB)", async () => {
    removeAllAdmins();
    const { status, json } = await call("POST", "/api/admin/auth/setup", {
        body: {
            name: "First Admin",
            email: "first@bluedise.test",
            password: "FirstSetupPassw0rd!789",
            confirmPassword: "FirstSetupPassw0rd!789",
        },
    });
    assert.equal(status, 201);
    assert.equal(json.success, true);
    assert.ok(json.id, "should return the new admin id");

    // Exactly one admin now exists.
    assert.equal(adminRows().length, 1);

    // The created admin is persisted with the correct attributes.
    const created = users.find((u) => u.email === "first@bluedise.test");
    assert.ok(created, "created admin must be stored");
    assert.equal(created.role, "admin");
    assert.equal(created.is_active, 1);
    assert.equal(created.token_version, 0);
    assert.notEqual(created.password, "FirstSetupPassw0rd!789", "password must be hashed");
    assert.ok(await bcrypt.compare("FirstSetupPassw0rd!789", created.password), "hash must verify");

    // Setup status flips to unavailable once one admin exists.
    const st = await call("GET", "/api/admin/auth/setup-status");
    assert.equal(st.json.setup_available, false);
});

test("one admin exists → a second setup attempt is rejected", async () => {
    assert.equal(adminRows().length, 1, "first admin must still exist");
    const { status, json } = await call("POST", "/api/admin/auth/setup", {
        body: {
            name: "Second Admin",
            email: "second@bluedise.test",
            password: "SecondSetupPassw0rd!999",
            confirmPassword: "SecondSetupPassw0rd!999",
        },
    });
    assert.equal(status, 403);
    assert.equal(json.message, "An administrator account already exists. Please use the admin login portal.");
    assert.equal(adminRows().length, 1, "no second admin may be created");
});

test("deleting the admin makes setup available again with no manual reset (MOCKED DB)", async () => {
    removeAllAdmins();
    assert.equal(adminRows().length, 0);

    const st = await call("GET", "/api/admin/auth/setup-status");
    assert.equal(st.status, 200);
    assert.equal(st.json.setup_available, true, "setup must become available after the admin is deleted");
});

test("a replacement admin can be created after deletion, locking setup again (MOCKED DB)", async () => {
    const { status, json } = await call("POST", "/api/admin/auth/setup", {
        body: {
            name: "Replacement Admin",
            email: "replacement@bluedise.test",
            password: "ReplacementPassw0rd!321",
            confirmPassword: "ReplacementPassw0rd!321",
        },
    });
    assert.equal(status, 201);
    assert.equal(json.success, true);
    assert.equal(adminRows().length, 1);

    const st = await call("GET", "/api/admin/auth/setup-status");
    assert.equal(st.json.setup_available, false);
});

test("two simultaneous setup requests create at most one admin (MOCKED DB, row-lock serialized)", async () => {
    removeAllAdmins();

    const body = {
        name: "Race Admin",
        email: "race@bluedise.test",
        password: "RaceSetupPassw0rd!111",
        confirmPassword: "RaceSetupPassw0rd!111",
    };

    const [a, b] = await Promise.all([
        call("POST", "/api/admin/auth/setup", { body }),
        call("POST", "/api/admin/auth/setup", { body }),
    ]);

    const statuses = [a.status, b.status].sort();
    assert.deepEqual(statuses, [201, 403], "exactly one request must succeed, the other must be rejected");
    assert.equal(adminRows().length, 1, "exactly one admin row may exist");

    removeAllAdmins();
});

/* ══ 9b. Setup input validation (MOCKED DB) ══ */

test("setup rejects missing fields", async () => {
    removeAllAdmins();
    const { status } = await call("POST", "/api/admin/auth/setup", { body: {} });
    assert.equal(status, 400);
});

test("setup rejects an invalid email", async () => {
    removeAllAdmins();
    const { status, json } = await call("POST", "/api/admin/auth/setup", {
        body: {
            name: "A",
            email: "not-an-email",
            password: "FreshSetupPassw0rd!123",
            confirmPassword: "FreshSetupPassw0rd!123",
        },
    });
    assert.equal(status, 400);
    assert.match(json.message, /valid email/);
});

test("setup rejects a short password", async () => {
    removeAllAdmins();
    const { status, json } = await call("POST", "/api/admin/auth/setup", {
        body: {
            name: "A",
            email: "newadmin@bluedise.test",
            password: "short",
            confirmPassword: "short",
        },
    });
    assert.equal(status, 400);
    assert.match(json.message, /at least 16 characters/);
});

test("setup rejects mismatched passwords", async () => {
    removeAllAdmins();
    const { status, json } = await call("POST", "/api/admin/auth/setup", {
        body: {
            name: "A",
            email: "newadmin@bluedise.test",
            password: "FreshSetupPassw0rd!123",
            confirmPassword: "DifferentPassw0rd!456",
        },
    });
    assert.equal(status, 400);
    assert.equal(json.message, "Passwords do not match.");
});

/* ══ 10. Admin self-deletion (MOCKED DB) ══
   DELETE /api/admin/auth/account validates the current password, removes
   exactly the authenticated admin row, and — because setup is gated purely by
   the live admin count — re-opens /admin/setup for a replacement admin. */

let staleAdminToken;
let replacementAdminId;
let replacementAdminPassword;
let replacementAdminToken;

async function provisionAdmin(email, password) {
    const setup = await call("POST", "/api/admin/auth/setup", {
        body: { name: "Delete Target", email, password, confirmPassword: password },
    });
    assert.equal(setup.status, 201);
    assert.equal(adminRows().length, 1);
    return { id: setup.json.id, email, password };
}

test("self-delete succeeds with the correct password and removes the admin row (MOCKED DB)", async () => {
    removeAllAdmins();
    const admin = await provisionAdmin("self-del@bluedise.test", "SelfDelPassw0rd!123");
    const token = sign(admin.id, "admin");

    // The token authorizes admin endpoints before deletion.
    const before = await call("GET", "/api/admin/auth/me", { token });
    assert.equal(before.status, 200);

    const { status, json } = await call("DELETE", "/api/admin/auth/account", {
        token,
        body: { password: "SelfDelPassw0rd!123" },
    });
    assert.equal(status, 200);
    assert.equal(json.success, true);
    assert.match(json.message, /Administrator account deleted/);

    // The admin row is gone and no other role is touched.
    assert.equal(adminRows().length, 0);
    const gone = users.find((u) => u.email === admin.email);
    assert.ok(!gone, "admin row must be removed from the database");
    const normalUser = users.find((u) => Number(u.id) === 3);
    assert.ok(normalUser && normalUser.role === "user", "normal users must be untouched");

    staleAdminToken = token;
});

test("the deleted admin's JWT no longer authorizes /me or admin APIs (MOCKED DB)", async () => {
    assert.ok(staleAdminToken, "stale token must be carried from the previous test");

    // adminAuthMiddleware re-reads the user per request: no row -> 401.
    const me = await call("GET", "/api/admin/auth/me", { token: staleAdminToken });
    assert.equal(me.status, 401);

    // roleMiddleware re-reads the user per request: no row -> 404.
    const api = await call("GET", "/api/admin/users-summary", { token: staleAdminToken });
    assert.equal(api.status, 404);
    assert.equal(api.json.message, "User not found");
});

test("self-delete rejects a wrong password and keeps the account (MOCKED DB)", async () => {
    removeAllAdmins();
    const admin = await provisionAdmin("wrong-pw@bluedise.test", "WrongPwPassw0rd!999");
    const token = sign(admin.id, "admin");

    const { status, json } = await call("DELETE", "/api/admin/auth/account", {
        token,
        body: { password: "TotallyWrongPassw0rd!123" },
    });
    assert.equal(status, 401);
    assert.equal(json.message, "Invalid credentials.");
    assert.equal(adminRows().length, 1, "account must remain after a wrong password");
});

test("self-delete rejects a missing password (MOCKED DB)", async () => {
    removeAllAdmins();
    const admin = await provisionAdmin("missing-pw@bluedise.test", "MissingPwPassw0rd!777");
    const token = sign(admin.id, "admin");

    const { status } = await call("DELETE", "/api/admin/auth/account", { token, body: {} });
    assert.equal(status, 400);
    assert.equal(adminRows().length, 1, "account must remain when password is missing");
});

test("self-delete rejects a non-admin token (MOCKED DB)", async () => {
    const userToken = sign(3, "user");
    const { status, json } = await call("DELETE", "/api/admin/auth/account", {
        token: userToken,
        body: { password: USER_PASSWORD },
    });
    assert.equal(status, 403);
    assert.equal(json.message, "Admin access required");
});

test("self-delete rejects an inactive admin (MOCKED DB)", async () => {
    removeAllAdmins();
    const admin = await provisionAdmin("inactive@bluedise.test", "InactivePassw0rd!555");
    const stored = users.find((u) => Number(u.id) === Number(admin.id));
    assert.ok(stored);
    stored.is_active = 0; // e.g. deactivated by another admin

    const token = sign(admin.id, "admin");
    const { status, json } = await call("DELETE", "/api/admin/auth/account", {
        token,
        body: { password: "InactivePassw0rd!555" },
    });
    // adminAuthMiddleware blocks inactive admins before the controller runs.
    assert.equal(status, 403);
    assert.match(json.message, /blocked/);
    assert.equal(adminRows().length, 1, "inactive admin must not be deleted");
});

test("self-delete rejects an invalid / forged JWT (MOCKED DB)", async () => {
    const forged = sign(1, "admin", "wrong-secret");
    const { status } = await call("DELETE", "/api/admin/auth/account", {
        token: forged,
        body: { password: "WhateverPassw0rd!123" },
    });
    assert.equal(status, 401);
});

test("after the admin is deleted, setup-status reports setup_available: true (MOCKED DB)", async () => {
    removeAllAdmins();
    const { status, json } = await call("GET", "/api/admin/auth/setup-status");
    assert.equal(status, 200);
    assert.equal(json.setup_available, true);
});

test("a replacement admin can be created after self-deletion (MOCKED DB)", async () => {
    removeAllAdmins();
    const setup = await call("POST", "/api/admin/auth/setup", {
        body: {
            name: "Replacement",
            email: "replacement2@bluedise.test",
            password: "ReplacePassw0rd!246",
            confirmPassword: "ReplacePassw0rd!246",
        },
    });
    assert.equal(setup.status, 201);
    assert.equal(adminRows().length, 1);
    replacementAdminId = setup.json.id;
    replacementAdminPassword = "ReplacePassw0rd!246";
});

test("the replacement admin can sign in through the admin login portal (MOCKED DB)", async () => {
    assert.ok(replacementAdminId, "replacement admin must be provisioned first");
    // Reset the login limiter key exhausted by earlier tests so the real
    // login endpoint can be exercised here.
    realRateLimits.adminAuthLoginLimiter.resetKey("ip:127.0.0.1");

    const { status, json } = await call("POST", "/api/admin/auth/login", {
        body: { email: "replacement2@bluedise.test", password: replacementAdminPassword },
    });
    assert.equal(status, 200);
    assert.equal(json.role, "admin");
    replacementAdminToken = json.token;
});

test("the replacement admin can access admin-protected APIs (MOCKED DB)", async () => {
    assert.ok(replacementAdminToken, "replacement admin token must exist");

    const me = await call("GET", "/api/admin/auth/me", { token: replacementAdminToken });
    assert.equal(me.status, 200);

    const api = await call("GET", "/api/admin/users-summary", { token: replacementAdminToken });
    assert.equal(api.status, 200);
    assert.equal(api.json.totalUsers, 1);
});

test("normal user accounts remain untouched after admin self-deletion (MOCKED DB)", async () => {
    const normal = users.find((u) => Number(u.id) === 3);
    assert.ok(normal, "normal user must still exist");
    assert.equal(normal.role, "user");
    assert.equal(normal.is_active, 1);
});
