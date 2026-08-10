module.exports = async (db) => {
    try {
        // ─── Helper: safely add a named FK only if it doesn't already exist ───
        const addFKIfNotExists = async (table, constraintName, column, refTable, refCol, onDelete = 'CASCADE') => {
            try {
                const [rows] = await db.query(
                    `SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?`,
                    [table, constraintName]
                );
                if (!rows.length) {
                    await db.query(
                        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraintName}\`
                         FOREIGN KEY (\`${column}\`) REFERENCES \`${refTable}\`(\`${refCol}\`) ON DELETE ${onDelete}`
                    );
                    console.log(`✅ FK added: ${constraintName}`);
                }
            } catch (e) {
                console.warn(`⚠️  FK skipped (${constraintName}):`, e?.message);
            }
        };

        // ════════════════════════════════════════════════════════════
        // 1. packages  — no dependencies
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS packages (
                id            INT AUTO_INCREMENT PRIMARY KEY,
                name          VARCHAR(100)    NOT NULL,
                description   TEXT,
                price         DECIMAL(10,2)   NOT NULL,
                duration_days INT             NOT NULL DEFAULT 30,
                duration_months INT           NOT NULL DEFAULT 1,
                tier_type     VARCHAR(20)     NOT NULL DEFAULT 'premium',
                membership_level INT          NOT NULL DEFAULT 1,
                features      TEXT,
                is_active     TINYINT(1)      NOT NULL DEFAULT 1,
                created_at    TIMESTAMP       DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('packages table verified');

        // ─── Add packages.membership_level column if missing ───────
        // Drives the membership hierarchy (DB-driven, independent of
        // package id / name / price). Silver=1, Gold=2, Platinum=3.
        const [pkgCols2] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages'"
        );
        const pkgColNames2 = pkgCols2.map(c => c.COLUMN_NAME.toLowerCase());
        if (!pkgColNames2.includes('membership_level')) {
            await db.query(
                `ALTER TABLE packages ADD COLUMN \`membership_level\` INT NOT NULL DEFAULT 1`
            );
            console.log('✅ Added membership_level column to packages');
        }

        // Backfill membership_level from tier_type for any rows that
        // still carry the legacy default (1) but have a higher tier.
        await db.query(`
            UPDATE packages
            SET membership_level = CASE
                WHEN tier_type = 'silver'  THEN 1
                WHEN tier_type = 'Gold'    THEN 2
                WHEN tier_type = 'premium' THEN 3   -- Platinum package uses tier_type 'premium'
                WHEN tier_type = 'starter' THEN 1
                WHEN tier_type = 'elite'   THEN 3
                ELSE membership_level
            END
            WHERE membership_level = 1
        `);

        // ─── Add packages.type column if missing ───────────────────
        const [pkgCols] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'packages'"
        );
        const pkgColNames = pkgCols.map(c => c.COLUMN_NAME.toLowerCase());
        if (!pkgColNames.includes('type')) {
            await db.query(
                `ALTER TABLE packages ADD COLUMN \`type\` ENUM('user','provider') NOT NULL DEFAULT 'user'`
            );
            console.log('✅ Added type column to packages');
        }

        // ════════════════════════════════════════════════════════════
        // 2. features  — no dependencies
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS features (
                id              INT AUTO_INCREMENT PRIMARY KEY,
                feature_key     VARCHAR(100) NOT NULL UNIQUE,
                display_name    VARCHAR(150) NOT NULL,
                description     VARCHAR(255),
                scope           ENUM('user','provider','both') NOT NULL DEFAULT 'both',
                is_coming_soon  TINYINT(1) NOT NULL DEFAULT 0
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        console.log('features table verified');

        // ─── Migrate features table: add id + display_name if using old schema ──
        const [featCols] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'features'"
        );
        const featColNames = featCols.map(c => c.COLUMN_NAME.toLowerCase());

        // If old schema had feature_key as PRIMARY KEY (no id), add id column
        if (!featColNames.includes('id')) {
            await db.query(`ALTER TABLE features DROP PRIMARY KEY`);
            await db.query(`ALTER TABLE features ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST`);
            await db.query(`ALTER TABLE features ADD UNIQUE KEY uq_feature_key (feature_key)`);
            console.log('✅ Migrated features table: added id column');
        }
        if (!featColNames.includes('display_name')) {
            await db.query(`ALTER TABLE features ADD COLUMN display_name VARCHAR(150) NOT NULL DEFAULT ''`);
            console.log('✅ Added display_name to features');
        }
        if (!featColNames.includes('scope')) {
            await db.query(`ALTER TABLE features ADD COLUMN scope ENUM('user','provider','both') NOT NULL DEFAULT 'both'`);
            console.log('✅ Added scope to features');
        }
        if (!featColNames.includes('is_coming_soon')) {
            await db.query(`ALTER TABLE features ADD COLUMN is_coming_soon TINYINT(1) NOT NULL DEFAULT 0`);
            console.log('✅ Added is_coming_soon to features');
        }

        // ─── Seed user features ───────────────────────────────────
        // NOTE: These are the canonical user feature keys.
        // UI + DB-driven gates expect these exact feature_key values.
        const userFeatures = [
            { key: 'partner_search',            display: 'Partner Search', scope: 'user' },
            { key: 'unlimited_profile_view',   display: 'Unlimited Profile Views', scope: 'user' },
            { key: 'basic_chat',               display: 'Chat', scope: 'user' },
            { key: 'audio_call',               display: 'Audio Call', scope: 'user' },
            { key: 'video_call',               display: 'Video Call', scope: 'user' },
            { key: 'advanced_search_filter',  display: 'Advanced Search Filter', scope: 'user' },
            { key: 'priority_matching',       display: 'Priority Matching', scope: 'user' },
            { key: 'verified_badge',          display: 'Verified Badge', scope: 'user' },
            { key: 'tour_access',             display: 'Tour/Event Access', scope: 'user' },
            { key: 'vip_support',             display: 'VIP Support', scope: 'user' },
        ];

        // ─── Seed provider features ───────────────────────────────
        // NOTE: provider feature keys are prefixed with `provider_` to avoid
        // colliding with user feature keys (e.g. audio_call, vip_support) that
        // share the same display name. The dedup-by-key logic below keeps the
        // LAST occurrence, so reusing a user key would overwrite its scope and
        // break the user membership feature mapping. Display names match the
        // product spec exactly.
        //
        //   Implemented now:        Chat, Browse Events, My Events
        //   Coming soon:            Audio Call, Video Call, Verified Badge,
        //                           Priority Matching, VIP Support
        const providerFeatures = [
            { key: 'provider_chat',             display: 'Chat', scope: 'provider' },
            { key: 'provider_browse_events',    display: 'Browse Events', scope: 'provider' },
            { key: 'provider_my_events',        display: 'My Events', scope: 'provider' },
            { key: 'provider_audio_call',       display: 'Audio Call', scope: 'provider' },
            { key: 'provider_video_call',       display: 'Video Call', scope: 'provider' },
            { key: 'provider_verified_badge',  display: 'Verified Badge', scope: 'provider' },
            { key: 'provider_priority_matching', display: 'Priority Matching', scope: 'provider' },
            { key: 'provider_vip_support',     display: 'VIP Support', scope: 'provider' },
        ];

        const allFeatures = [...userFeatures, ...providerFeatures];
        // Deduplicate by key (keep last occurrence so provider/user scoped versions override)
        const uniqueFeatures = [...new Map(allFeatures.map(f => [f.key, f])).values()];

        const comingSoonByKey = new Map([
            ['audio_call', 1],
            ['video_call', 1],
            ['advanced_search_filter', 1],
            ['vip_support', 1],
            // Provider coming-soon features (DB-driven via is_coming_soon)
            ['provider_audio_call', 1],
            ['provider_video_call', 1],
            ['provider_verified_badge', 0],
            ['provider_priority_matching', 1],
            ['provider_vip_support', 1],
        ]);

        for (const feat of uniqueFeatures) {
            const isComingSoon = comingSoonByKey.get(feat.key) ?? 0;
            await db.query(
                `INSERT INTO features (feature_key, display_name, scope, is_coming_soon)
                 VALUES (?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE
                    display_name = VALUES(display_name),
                    scope = VALUES(scope),
                    is_coming_soon = VALUES(is_coming_soon)`,
                [feat.key, feat.display, feat.scope, isComingSoon]
            );
        }
        console.log('✅ Features seeded');

        // ─── Prune stale provider features ──────────────────────────
        // The seed above only UPSERTs, so provider features removed from the
        // spec (e.g. the old analytics_dashboard, featured_profile, etc.)
        // would linger in the DB and appear as "extra" options in the admin
        // provider package creator. Remove any provider-scoped feature whose
        // key is not in the current provider spec list.
        const providerSpecKeys = new Set(providerFeatures.map(f => f.key));
        const [staleProvider] = await db.query(
            "SELECT id FROM features WHERE scope = 'provider' AND feature_key NOT IN (?)",
            [Array.from(providerSpecKeys)]
        );
        if (staleProvider.length) {
            const staleIds = staleProvider.map(r => r.id);
            // package_features rows cascade on feature delete (FK ON DELETE CASCADE)
            await db.query("DELETE FROM features WHERE id IN (?)", [staleIds]);
            console.log(`🧹 Removed ${staleIds.length} stale provider feature(s):`, staleProvider.map(r => r.feature_key).join(', '));
        }

        // ════════════════════════════════════════════════════════════
        // 3. package_features  — normalized schema migration
        //    Old: (package_tier_type VARCHAR, feature_key VARCHAR)
        //    New: (id INT PK, package_id INT FK, feature_id INT FK)
        // ════════════════════════════════════════════════════════════
        const [pfCols] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'package_features'"
        );
        const pfColNames = pfCols.map(c => c.COLUMN_NAME.toLowerCase());

        if (pfColNames.length === 0) {
            // Table doesn't exist — create fresh normalized schema
            await db.query(`
                CREATE TABLE IF NOT EXISTS package_features (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    package_id INT NOT NULL,
                    feature_id INT NOT NULL,
                    UNIQUE KEY uq_pkg_feat (package_id, feature_id),
                    CONSTRAINT fk_pf_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
                    CONSTRAINT fk_pf_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✅ package_features table created (normalized)');
        } else if (pfColNames.includes('package_tier_type')) {
            // Old schema — migrate to normalized
            console.log('🔄 Migrating package_features to normalized schema…');

            // 1. Drop old FKs if any
            try {
                const [fkRows] = await db.query(
                    `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'package_features'
                     AND CONSTRAINT_TYPE = 'FOREIGN KEY'`
                );
                for (const row of fkRows) {
                    await db.query(`ALTER TABLE package_features DROP FOREIGN KEY \`${row.CONSTRAINT_NAME}\``);
                }
            } catch(e) {
                console.warn('FK drop skipped:', e?.message);
            }

            // 2. Drop old PK
            try {
                await db.query(`ALTER TABLE package_features DROP PRIMARY KEY`);
            } catch(e) { console.warn('PK drop skipped:', e?.message); }

            // 3. Rename old columns for migration temp use
            await db.query(`ALTER TABLE package_features
                CHANGE COLUMN package_tier_type old_tier_type VARCHAR(20) NULL,
                CHANGE COLUMN feature_key old_feature_key VARCHAR(100) NULL`);

            // 4. Add new normalized columns
            await db.query(`ALTER TABLE package_features
                ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST,
                ADD COLUMN package_id INT NULL,
                ADD COLUMN feature_id INT NULL`);

            // 5. Populate package_id from old tier_type by matching packages.tier_type
            await db.query(`
                UPDATE package_features pf
                JOIN packages p ON p.tier_type = pf.old_tier_type
                SET pf.package_id = p.id
                WHERE pf.package_id IS NULL
            `);

            // 6. Populate feature_id from old feature_key
            await db.query(`
                UPDATE package_features pf
                JOIN features f ON f.feature_key = pf.old_feature_key
                SET pf.feature_id = f.id
                WHERE pf.feature_id IS NULL
            `);

            // 7. Delete rows we couldn't migrate
            await db.query(`DELETE FROM package_features WHERE package_id IS NULL OR feature_id IS NULL`);

            // 8. Drop old columns
            await db.query(`ALTER TABLE package_features
                DROP COLUMN old_tier_type,
                DROP COLUMN old_feature_key`);

            // 9. Make package_id / feature_id NOT NULL
            await db.query(`ALTER TABLE package_features
                MODIFY COLUMN package_id INT NOT NULL,
                MODIFY COLUMN feature_id INT NOT NULL`);

            // 10. Add unique constraint
            try {
                await db.query(`ALTER TABLE package_features ADD UNIQUE KEY uq_pkg_feat (package_id, feature_id)`);
            } catch(e) { console.warn('Unique key skipped:', e?.message); }

            // 11. Add FKs
            await addFKIfNotExists('package_features', 'fk_pf_package', 'package_id', 'packages', 'id', 'CASCADE');
            await addFKIfNotExists('package_features', 'fk_pf_feature', 'feature_id', 'features', 'id', 'CASCADE');

            console.log('✅ package_features migrated to normalized schema');
        } else if (!pfColNames.includes('package_id')) {
            // Has some other unexpected shape — just recreate
            console.warn('⚠️  package_features has unexpected schema, attempting safe drop-recreate');
            await db.query(`DROP TABLE IF EXISTS package_features`);
            await db.query(`
                CREATE TABLE package_features (
                    id         INT AUTO_INCREMENT PRIMARY KEY,
                    package_id INT NOT NULL,
                    feature_id INT NOT NULL,
                    UNIQUE KEY uq_pkg_feat (package_id, feature_id),
                    CONSTRAINT fk_pf_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
                    CONSTRAINT fk_pf_feature FOREIGN KEY (feature_id) REFERENCES features(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `);
            console.log('✅ package_features recreated (normalized)');
        } else {
            // Already normalized — just ensure FKs exist
            await addFKIfNotExists('package_features', 'fk_pf_package', 'package_id', 'packages', 'id', 'CASCADE');
            await addFKIfNotExists('package_features', 'fk_pf_feature', 'feature_id', 'features', 'id', 'CASCADE');
            console.log('package_features table verified (already normalized)');
        }

        // ════════════════════════════════════════════════════════════
        // 4. users  — depends on packages
        // ════════════════════════════════════════════════════════════

        // Ensure the base users table exists before any ALTER TABLE users.
        // On a fresh database this is created here (idempotently); the column
        // adds below then apply the wallet/membership/profile columns.
        await db.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(255) NOT NULL UNIQUE,
                phone VARCHAR(20) NOT NULL,
                password VARCHAR(255) NOT NULL,
                role ENUM('user', 'provider', 'admin') DEFAULT 'user',
                is_active TINYINT(1) DEFAULT 1,
                privacy_accepted TINYINT(1) DEFAULT 0,
                privacy_accepted_at TIMESTAMP NULL,
                token_version INT NOT NULL DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_email (email),
                INDEX idx_role (role),
                INDEX idx_is_active (is_active),
                INDEX idx_privacy_accepted (privacy_accepted),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // --- wallet columns ---
        const [userCols] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
        );
        let colNames = userCols.map(c => c.COLUMN_NAME.toLowerCase());

        if (!colNames.includes('balance')) {
            await db.query("ALTER TABLE users ADD COLUMN balance DECIMAL(15,2) DEFAULT 0.00");
            console.log('Added balance to users');
        }
        if (!colNames.includes('earnings')) {
            await db.query("ALTER TABLE users ADD COLUMN earnings DECIMAL(15,2) DEFAULT 0.00");
            console.log('Added earnings to users');
        }

        // --- membership columns ---
        const membershipCols = [
            { name: 'membership_package_id',  type: 'INT NULL' },
            { name: 'membership_started_at',   type: 'DATETIME NULL' },
            { name: 'membership_expires_at',   type: 'DATETIME NULL' },
        ];
        // refresh
        const [uc2] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
        );
        colNames = uc2.map(c => c.COLUMN_NAME.toLowerCase());
        for (const col of membershipCols) {
            if (!colNames.includes(col.name.toLowerCase())) {
                await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Added ${col.name} to users`);
            }
        }

        // --- profile columns ---
        const profileCols = [
            { name: 'gender',            type: 'VARCHAR(50) NULL' },
            { name: 'date_of_birth',     type: 'DATE NULL' },
            { name: 'profession',        type: 'VARCHAR(100) NULL' },
            { name: 'education',         type: 'VARCHAR(150) NULL' },
            { name: 'location',          type: 'VARCHAR(150) NULL' },
            { name: 'bio',               type: 'TEXT NULL' },
            { name: 'interests',         type: 'TEXT NULL' },
            { name: 'relationship_goal', type: 'VARCHAR(100) NULL' },
            { name: 'marital_status',    type: 'VARCHAR(100) NULL' },
            { name: 'avatar_url',        type: 'TEXT NULL' },
        ];
        // refresh again
        const [uc3] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
        );
        colNames = uc3.map(c => c.COLUMN_NAME.toLowerCase());
        for (const col of profileCols) {
            if (!colNames.includes(col.name.toLowerCase())) {
                await db.query(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`);
                console.log(`Added ${col.name} to users`);
            }
        }

        // --- auth session column (admin token invalidation) ---
        // token_version lets the admin auth middleware reject stale JWTs after
        // a password change. Defaults to 0 for every existing account.
        const [uc4] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'"
        );
        const colNames4 = uc4.map(c => c.COLUMN_NAME.toLowerCase());
        if (!colNames4.includes('token_version')) {
            await db.query(`ALTER TABLE users ADD COLUMN \`token_version\` INT NOT NULL DEFAULT 0`);
            console.log('✅ Added token_version to users');
        }

        // FK: users.membership_package_id -> packages.id
        await addFKIfNotExists('users', 'fk_users_pkg', 'membership_package_id', 'packages', 'id', 'SET NULL');
        console.log('users table verified');

        // ════════════════════════════════════════════════════════════
        // 5. posts  — depends on users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS posts (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                user_id    INT          NOT NULL,
                content    TEXT         NOT NULL,
                image_url  VARCHAR(500),
                created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('posts', 'fk_posts_user', 'user_id', 'users', 'id', 'CASCADE');
        console.log('posts table verified');

        // ════════════════════════════════════════════════════════════
        // 6. events  — depends on users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS events (
                id                   INT AUTO_INCREMENT PRIMARY KEY,
                title                VARCHAR(255)  NOT NULL,
                description          TEXT,
                date_time            DATETIME      NOT NULL,
                location             VARCHAR(255)  NOT NULL,
                capacity             INT           NOT NULL DEFAULT 0,
                creator_id           INT           NOT NULL,
                status               VARCHAR(50)   DEFAULT 'active',
                created_at           TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                host_name            VARCHAR(150)  NULL,
                application_deadline DATETIME      NULL,
                entry_fee            DECIMAL(10,2) DEFAULT 0,
                CONSTRAINT fk_events_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // backward-compat column adds
        const [evCols] = await db.query(
            "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'events'"
        );
        const evColNames = evCols.map(c => c.COLUMN_NAME.toLowerCase());
        if (!evColNames.includes('host_name'))            await db.query("ALTER TABLE events ADD COLUMN host_name VARCHAR(150) NULL");
        if (!evColNames.includes('application_deadline')) await db.query("ALTER TABLE events ADD COLUMN application_deadline DATETIME NULL");
        if (!evColNames.includes('entry_fee'))            await db.query("ALTER TABLE events ADD COLUMN entry_fee DECIMAL(10,2) DEFAULT 0");

        await addFKIfNotExists('events', 'fk_events_creator', 'creator_id', 'users', 'id', 'CASCADE');
        console.log('events table verified');

        // ════════════════════════════════════════════════════════════
        // 7. transactions  — depends on users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                user_id     INT NOT NULL,
                type        ENUM('deposit','withdraw','earning','event_payment','event_income','membership_purchase') NOT NULL,
                amount      DECIMAL(15,2) NOT NULL,
                status      VARCHAR(20)   DEFAULT 'completed',
                description VARCHAR(255),
                created_at  TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_txn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        // ✅ Fix ENUM — always keep ALL values
        const [txCols] = await db.query("SHOW COLUMNS FROM transactions LIKE 'type'");
        if (txCols && txCols.length) {
            const enumStr = String(txCols[0].Type);
            if (!enumStr.includes('membership_purchase') || !enumStr.includes('event_payment')) {
                await db.query(
                    `ALTER TABLE transactions MODIFY COLUMN type
                     ENUM('deposit','withdraw','earning','event_payment','event_income','membership_purchase') NOT NULL`
                );
                console.log('Fixed transactions ENUM');
            }
        }
        await addFKIfNotExists('transactions', 'fk_txn_user', 'user_id', 'users', 'id', 'CASCADE');
        console.log('transactions table verified');

        // ════════════════════════════════════════════════════════════
        // 8. deposit_requests  — depends on users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS deposit_requests (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                user_id        INT           NOT NULL,
                amount         DECIMAL(15,2) NOT NULL,
                method         VARCHAR(20)   NOT NULL,
                trx_id         VARCHAR(100)  NOT NULL UNIQUE,
                screenshot_url TEXT          NOT NULL,
                status         VARCHAR(20)   NOT NULL DEFAULT 'Pending',
                admin_note     TEXT,
                approved_by    INT           NULL,
                approved_at    TIMESTAMP     NULL,
                created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_dep_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_dep_approved FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('deposit_requests', 'fk_dep_user',     'user_id',     'users', 'id', 'CASCADE');
        await addFKIfNotExists('deposit_requests', 'fk_dep_approved',  'approved_by', 'users', 'id', 'SET NULL');
        console.log('deposit_requests table verified');

        // ════════════════════════════════════════════════════════════
        // 9. withdraw_requests  — depends on users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS withdraw_requests (
                id             INT AUTO_INCREMENT PRIMARY KEY,
                user_id        INT           NOT NULL,
                amount         DECIMAL(15,2) NOT NULL,
                method         VARCHAR(20)   NOT NULL,
                account_number VARCHAR(100)  NOT NULL,
                status         VARCHAR(20)   NOT NULL DEFAULT 'Pending',
                admin_note     TEXT,
                approved_by    INT           NULL,
                approved_at    TIMESTAMP     NULL,
                created_at     TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_wdw_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_wdw_approved FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('withdraw_requests', 'fk_wdw_user',     'user_id',     'users', 'id', 'CASCADE');
        await addFKIfNotExists('withdraw_requests', 'fk_wdw_approved',  'approved_by', 'users', 'id', 'SET NULL');
        console.log('withdraw_requests table verified');

        // ════════════════════════════════════════════════════════════
        // 10. match_requests  — depends on users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS match_requests (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                sender_id   INT NOT NULL,
                receiver_id INT NOT NULL,
                status      ENUM('pending','accepted','rejected') NOT NULL DEFAULT 'pending',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_mr_sender   (sender_id),
                INDEX idx_mr_receiver (receiver_id),
                INDEX idx_mr_status   (status),
                CONSTRAINT fk_mr_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_mr_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('match_requests', 'fk_mr_sender',   'sender_id',   'users', 'id', 'CASCADE');
        await addFKIfNotExists('match_requests', 'fk_mr_receiver', 'receiver_id', 'users', 'id', 'CASCADE');
        console.log('match_requests table verified');

        // ════════════════════════════════════════════════════════════
        // 11. event_participants  — depends on events + users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS event_participants (
                event_id  INT NOT NULL,
                user_id   INT NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (event_id, user_id),
                CONSTRAINT fk_ep_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
                CONSTRAINT fk_ep_user  FOREIGN KEY (user_id)  REFERENCES users(id)  ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('event_participants', 'fk_ep_event', 'event_id', 'events', 'id', 'CASCADE');
        await addFKIfNotExists('event_participants', 'fk_ep_user',  'user_id',  'users',  'id', 'CASCADE');
        console.log('event_participants table verified');

        // ════════════════════════════════════════════════════════════
        // 12. partner_requests  — USER → PROVIDER partner requests
        //     Distinct from match_requests (user↔user). Drives chat +
        //     full-profile access between a user and a provider once
        //     the provider accepts the request.
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS partner_requests (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                user_id     INT NOT NULL,
                provider_id INT NOT NULL,
                status      ENUM('pending','accepted','rejected','cancelled') NOT NULL DEFAULT 'pending',
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY uq_partner_user_provider (user_id, provider_id),
                CONSTRAINT fk_pr_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_pr_provider FOREIGN KEY (provider_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('partner_requests', 'fk_pr_user',     'user_id',     'users', 'id', 'CASCADE');
        await addFKIfNotExists('partner_requests', 'fk_pr_provider', 'provider_id', 'users', 'id', 'CASCADE');
        console.log('partner_requests table verified');

        // ════════════════════════════════════════════════════════════
        // 12. post_likes  — depends on posts + users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS post_likes (
                user_id    INT NOT NULL,
                post_id    INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (user_id, post_id),
                INDEX idx_pl_post (post_id),
                CONSTRAINT fk_pl_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                CONSTRAINT fk_pl_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('post_likes', 'fk_pl_post', 'post_id', 'posts', 'id', 'CASCADE');
        await addFKIfNotExists('post_likes', 'fk_pl_user', 'user_id', 'users', 'id', 'CASCADE');

        // ════════════════════════════════════════════════════════════
        // 13. post_comments  — depends on posts + users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS post_comments (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                post_id    INT  NOT NULL,
                user_id    INT  NOT NULL,
                content    TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_pc_post (post_id),
                INDEX idx_pc_user (user_id),
                CONSTRAINT fk_pc_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                CONSTRAINT fk_pc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('post_comments', 'fk_pc_post', 'post_id', 'posts', 'id', 'CASCADE');
        await addFKIfNotExists('post_comments', 'fk_pc_user', 'user_id', 'users', 'id', 'CASCADE');

        // ════════════════════════════════════════════════════════════
        // 14. post_shares  — depends on posts + users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS post_shares (
                id         INT AUTO_INCREMENT PRIMARY KEY,
                post_id    INT NOT NULL,
                user_id    INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_ps_post (post_id),
                CONSTRAINT fk_ps_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
                CONSTRAINT fk_ps_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('post_shares', 'fk_ps_post', 'post_id', 'posts', 'id', 'CASCADE');
        await addFKIfNotExists('post_shares', 'fk_ps_user', 'user_id', 'users', 'id', 'CASCADE');
        console.log('post interaction tables verified');

        // ════════════════════════════════════════════════════════════
        // 15. chat_messages  — depends on users
        // ════════════════════════════════════════════════════════════
        await db.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                sender_id   INT  NOT NULL,
                receiver_id INT  NOT NULL,
                message     TEXT NOT NULL,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_chat_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
                CONSTRAINT fk_chat_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
        await addFKIfNotExists('chat_messages', 'fk_chat_sender',   'sender_id',   'users', 'id', 'CASCADE');
        await addFKIfNotExists('chat_messages', 'fk_chat_receiver', 'receiver_id', 'users', 'id', 'CASCADE');
        console.log('chat_messages table verified');

        console.log('\n🎉 DB initialized successfully — all tables & foreign keys are set up.\n');

    } catch (err) {
        console.error('DB init error:', {
            message:    err?.message,
            code:       err?.code,
            errno:      err?.errno,
            sql:        err?.sql,
            sqlState:   err?.sqlState,
            sqlMessage: err?.sqlMessage,
            stack:      err?.stack,
        });
    }
};
