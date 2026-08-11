const test = require('node:test');
const assert = require('node:assert/strict');

const initTables = require('../src/startup/initTables');
const presenceMigration = require('../migrations/20260811_add_presence_columns_to_users.js');

// ── Column-aware in-memory DB stub ─────────────────────────────────────────
// `userColumns` mirrors the live `users` table. ALTER TABLE users ADD COLUMN
// mutates it, so running initTables/migrations upgrades the schema in memory —
// exactly like a real database. A presence UPDATE that references `last_seen`
// throws "Unknown column" when the column is absent, reproducing the exact
// production failure mode from the Render logs.

const BASE_USER_COLUMNS = [
    'id', 'name', 'email', 'phone', 'password', 'role', 'is_active',
    'privacy_accepted', 'privacy_accepted_at', 'token_version',
    'created_at', 'updated_at',
];

const FULL_USER_COLUMNS = [
    ...BASE_USER_COLUMNS,
    'balance', 'earnings',
    'membership_package_id', 'membership_started_at', 'membership_expires_at',
    'gender', 'date_of_birth', 'profession', 'education', 'location', 'bio',
    'interests', 'relationship_goal', 'marital_status', 'avatar_url',
];

const PACKAGES_COLUMNS = [
    'id', 'name', 'description', 'price', 'duration_days', 'duration_months',
    'tier_type', 'membership_level', 'features', 'type', 'is_active', 'created_at',
];
const FEATURES_COLUMNS = ['id', 'feature_key', 'display_name', 'description', 'scope', 'is_coming_soon'];
const EVENTS_COLUMNS = [
    'id', 'title', 'description', 'date_time', 'location', 'capacity', 'creator_id',
    'status', 'created_at', 'host_name', 'application_deadline', 'entry_fee',
];

function makeDb({ userColumns = FULL_USER_COLUMNS } = {}) {
    const cols = [...userColumns];
    const log = [];

    const route = (sql, values = []) => {
        const S = String(sql);
        log.push(S);

        // information_schema column listings
        if (/information_schema\.columns/i.test(S)) {
            // Parameterized form used by migration helpers:
            //   ... TABLE_NAME = ? AND COLUMN_NAME = ?
            if (/table_name = \?/i.test(S)) {
                const table = String(values[0]).toLowerCase();
                const col = values[1] ? String(values[1]).toLowerCase() : null;
                if (table === 'users') {
                    if (col) return cols.includes(col) ? [{ COLUMN_NAME: col }] : [];
                    return cols.map((c) => ({ COLUMN_NAME: c }));
                }
                return [];
            }
            // Literal form used by initTables.
            if (/table_name = 'users'/i.test(S)) {
                return cols.map((c) => ({ COLUMN_NAME: c }));
            }
            if (/table_name = 'packages'/i.test(S)) {
                return PACKAGES_COLUMNS.map((c) => ({ COLUMN_NAME: c }));
            }
            if (/table_name = 'features'/i.test(S)) {
                return FEATURES_COLUMNS.map((c) => ({ COLUMN_NAME: c }));
            }
            if (/table_name = 'package_features'/i.test(S)) {
                return []; // fresh-normalized creation path
            }
            if (/table_name = 'events'/i.test(S)) {
                return EVENTS_COLUMNS.map((c) => ({ COLUMN_NAME: c }));
            }
        }
        if (/information_schema\.key_column_usage/i.test(S)) return []; // FKs always get (re)added
        if (/show columns from transactions like 'type'/i.test(S)) {
            return [{ Type: "enum('deposit','withdraw','earning','event_payment','event_income','membership_purchase')" }];
        }
        if (/select count\(\*\)\s+as\s+total/i.test(S)) return [{ total: 1 }];
        if (/select id from features where scope = 'provider'/i.test(S)) return [];

        // presence UPDATE (authMiddleware) — reproduces the prod failure mode
        if (/^update users set last_seen/i.test(S)) {
            if (!cols.includes('last_seen')) {
                throw new Error("Unknown column 'last_seen' in 'field list'");
            }
            if (!cols.includes('is_online')) {
                throw new Error("Unknown column 'is_online' in 'field list'");
            }
            return [];
        }
        if (/^update users/i.test(S)) return [];
        if (/^update packages/i.test(S)) return [];

        // ALTER TABLE users ... mutates the in-memory schema
        const dropCol = S.match(/alter table users drop column `?([a-z_]+)`?/i);
        if (dropCol) {
            const idx = cols.indexOf(dropCol[1].toLowerCase());
            if (idx >= 0) cols.splice(idx, 1);
            return [];
        }
        const addCol = S.match(/alter table users add column `?([a-z_]+)`?\s+(.+)$/i);
        if (addCol) {
            const name = addCol[1].toLowerCase();
            if (!cols.includes(name)) cols.push(name);
            return [];
        }
        if (/alter table users/i.test(S)) return [];

        if (/^(create|alter|insert|drop)/i.test(S)) return [];
        return [];
    };

    return {
        get userColumns() { return [...cols]; },
        get log() { return log.slice(); },
        async query(sql, values, cb) {
            const rows = route(sql, values);
            if (typeof cb === 'function') { cb(null, rows); return {}; }
            return [rows, []];
        },
        getConnection() { throw new Error('getConnection not used in this test'); },
    };
}

const PRESENCE_UPDATE = "UPDATE users SET last_seen = NOW(), is_online = 1 WHERE id = ?";

/* ══ initTables startup schema initializer ══ */

test('fresh schema: initTables creates presence columns last_seen + is_online', async () => {
    const db = makeDb({ userColumns: BASE_USER_COLUMNS });
    await initTables(db);

    assert.ok(db.userColumns.includes('last_seen'), 'last_seen must be created');
    assert.ok(db.userColumns.includes('is_online'), 'is_online must be created');

    // Type/nullability must match the existing migration convention.
    const lastSeenAlter = db.log.find((s) => /alter table users add column.*last_seen/i.test(s));
    assert.ok(lastSeenAlter, 'initTables must issue ALTER for last_seen');
    assert.match(lastSeenAlter, /TIMESTAMP NULL/, 'last_seen must be TIMESTAMP NULL');

    const isOnlineAlter = db.log.find((s) => /alter table users add column.*is_online/i.test(s));
    assert.ok(isOnlineAlter, 'initTables must issue ALTER for is_online');
    assert.match(isOnlineAlter, /TINYINT\(1\) DEFAULT 0/, 'is_online must be TINYINT(1) DEFAULT 0');
});

test('existing schema without presence columns: initTables adds exactly them (idempotent for the rest)', async () => {
    const db = makeDb({ userColumns: FULL_USER_COLUMNS });
    await initTables(db);

    assert.ok(db.userColumns.includes('last_seen'));
    assert.ok(db.userColumns.includes('is_online'));

    const userAlters = db.log.filter((s) => /^alter table users add column/i.test(s));
    assert.equal(userAlters.length, 2, 'only last_seen + is_online should be added');
    assert.ok(!db.log.some((s) => /alter table users add column balance/i.test(s)), 'balance must not be re-added');
    assert.ok(!db.log.some((s) => /alter table users add column token_version/i.test(s)), 'token_version must not be re-added');
});

test('existing schema with presence columns: initTables is a no-op and does not fail', async () => {
    const db = makeDb({ userColumns: [...FULL_USER_COLUMNS, 'last_seen', 'is_online'] });
    await initTables(db);
    assert.equal(db.log.filter((s) => /^alter table users add column/i.test(s)).length, 0);
});

test('presence UPDATE referencing last_seen succeeds after initTables upgrade (prod bug regression)', async () => {
    // Reproduces the exact production failure BEFORE the fix, then verifies the
    // startup initializer upgrades the schema so the same query works.
    const db = makeDb({ userColumns: FULL_USER_COLUMNS }); // missing last_seen + is_online

    await assert.rejects(
        () => db.query(PRESENCE_UPDATE, [1]),
        /Unknown column 'last_seen'/,
        'pre-fix schema must reproduce the production error'
    );

    await initTables(db);

    const rows = await db.query(PRESENCE_UPDATE, [1]);
    assert.ok(Array.isArray(rows), 'presence UPDATE must succeed once initTables adds the columns');
});

/* ══ 20260811_add_presence_columns_to_users migration ══ */

test('migration up() adds last_seen + is_online when missing and is idempotent', async () => {
    const db = makeDb({ userColumns: FULL_USER_COLUMNS });
    await presenceMigration.up(db);
    assert.ok(db.userColumns.includes('last_seen'));
    assert.ok(db.userColumns.includes('is_online'));

    const alterCount = db.log.filter((s) => /^alter table users add column/i.test(s)).length;
    assert.equal(alterCount, 2);

    await presenceMigration.up(db);
    assert.equal(
        db.log.filter((s) => /^alter table users add column/i.test(s)).length,
        alterCount,
        'second up() must be a no-op when columns already exist'
    );
});

test('migration up() is a no-op when columns already exist', async () => {
    const db = makeDb({ userColumns: [...FULL_USER_COLUMNS, 'last_seen', 'is_online'] });
    await presenceMigration.up(db);
    assert.equal(db.log.filter((s) => /^alter table users add column/i.test(s)).length, 0);
});

test('migration down() drops both presence columns', async () => {
    const db = makeDb({ userColumns: [...FULL_USER_COLUMNS, 'last_seen', 'is_online'] });
    await presenceMigration.down(db);
    assert.ok(!db.userColumns.includes('last_seen'));
    assert.ok(!db.userColumns.includes('is_online'));
});
