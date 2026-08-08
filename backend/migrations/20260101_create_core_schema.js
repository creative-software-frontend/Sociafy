/**
 * Core schema migration.
 *
 * Creates every persistent table that was previously created only at startup by
 * initTables.js, so a completely empty database can be built by running ONLY the
 * migration runner. Also completes the `users` table with the columns the
 * application requires (wallet, membership, profile, presence).
 *
 * Runs BEFORE 20260704_add_request_id_to_wallet_requests and
 * 20260714_add_membership_level_to_packages, which both ALTER tables created here.
 *
 * Safe on existing databases: CREATE TABLE IF NOT EXISTS is a no-op when the
 * table already exists, and column/FK adds are guarded via information_schema.
 */

module.exports = {
  up: async (db) => {
    const columnExists = async (table, column) => {
      const [rows] = await db.query(
        "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?",
        [table, column]
      );
      return rows.length > 0;
    };
    const ensureColumn = async (table, column, ddl) => {
      if (!(await columnExists(table, column))) {
        await db.query(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
      }
    };
    const ensureFK = async (table, constraint, column, refTable, refCol, onDelete) => {
      const [rows] = await db.query(
        "SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?",
        [table, constraint]
      );
      if (!rows.length) {
        try {
          await db.query(
            `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${constraint}\` FOREIGN KEY (\`${column}\`) REFERENCES \`${refTable}\`(\`${refCol}\`) ON DELETE ${onDelete}`
          );
        } catch (e) {
          // best-effort FK (mirrors initTables behaviour on legacy schemas)
        }
      }
    };

    // 1. packages
    await db.query(`
      CREATE TABLE IF NOT EXISTS packages (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        name             VARCHAR(100) NOT NULL,
        description      TEXT,
        price            DECIMAL(10,2) NOT NULL,
        duration_days    INT NOT NULL DEFAULT 30,
        duration_months  INT NOT NULL DEFAULT 1,
        tier_type        VARCHAR(20) NOT NULL DEFAULT 'premium',
        membership_level INT NOT NULL DEFAULT 1,
        features         TEXT,
        type             ENUM('user','provider') NOT NULL DEFAULT 'user',
        is_active        TINYINT(1) NOT NULL DEFAULT 1,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 2. features
    await db.query(`
      CREATE TABLE IF NOT EXISTS features (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        feature_key    VARCHAR(100) NOT NULL UNIQUE,
        display_name   VARCHAR(150) NOT NULL,
        description    VARCHAR(255),
        scope          ENUM('user','provider','both') NOT NULL DEFAULT 'both',
        is_coming_soon TINYINT(1) NOT NULL DEFAULT 0
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 3. package_features (normalized)
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

    // 4. users — complete the minimal table created by 20250120
    await ensureColumn('users', 'balance', 'balance DECIMAL(15,2) DEFAULT 0.00');
    await ensureColumn('users', 'earnings', 'earnings DECIMAL(15,2) DEFAULT 0.00');
    await ensureColumn('users', 'membership_package_id', 'membership_package_id INT NULL');
    await ensureColumn('users', 'membership_started_at', 'membership_started_at DATETIME NULL');
    await ensureColumn('users', 'membership_expires_at', 'membership_expires_at DATETIME NULL');
    await ensureColumn('users', 'gender', 'gender VARCHAR(50) NULL');
    await ensureColumn('users', 'date_of_birth', 'date_of_birth DATE NULL');
    await ensureColumn('users', 'profession', 'profession VARCHAR(100) NULL');
    await ensureColumn('users', 'education', 'education VARCHAR(150) NULL');
    await ensureColumn('users', 'location', 'location VARCHAR(150) NULL');
    await ensureColumn('users', 'bio', 'bio TEXT NULL');
    await ensureColumn('users', 'interests', 'interests TEXT NULL');
    await ensureColumn('users', 'relationship_goal', 'relationship_goal VARCHAR(100) NULL');
    await ensureColumn('users', 'marital_status', 'marital_status VARCHAR(100) NULL');
    await ensureColumn('users', 'avatar_url', 'avatar_url TEXT NULL');
    await ensureColumn('users', 'last_seen', 'last_seen TIMESTAMP NULL');
    await ensureColumn('users', 'is_online', 'is_online TINYINT(1) DEFAULT 0');
    await ensureFK('users', 'fk_users_pkg', 'membership_package_id', 'packages', 'id', 'SET NULL');

    // 5. transactions
    await db.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        type        ENUM('deposit','withdraw','earning','event_payment','event_income','membership_purchase') NOT NULL,
        amount      DECIMAL(15,2) NOT NULL,
        status      VARCHAR(20) DEFAULT 'completed',
        description VARCHAR(255),
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_txn_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 6. deposit_requests
    await db.query(`
      CREATE TABLE IF NOT EXISTS deposit_requests (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL,
        amount         DECIMAL(15,2) NOT NULL,
        method         VARCHAR(20) NOT NULL,
        trx_id         VARCHAR(100) NOT NULL UNIQUE,
        screenshot_url TEXT NOT NULL,
        status         VARCHAR(20) NOT NULL DEFAULT 'Pending',
        admin_note     TEXT,
        approved_by    INT NULL,
        approved_at    TIMESTAMP NULL,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_dep_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_dep_approved FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 7. withdraw_requests
    await db.query(`
      CREATE TABLE IF NOT EXISTS withdraw_requests (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        user_id        INT NOT NULL,
        amount         DECIMAL(15,2) NOT NULL,
        method         VARCHAR(20) NOT NULL,
        account_number VARCHAR(100) NOT NULL,
        status         VARCHAR(20) NOT NULL DEFAULT 'Pending',
        admin_note     TEXT,
        approved_by    INT NULL,
        approved_at    TIMESTAMP NULL,
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_wdw_user     FOREIGN KEY (user_id)     REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_wdw_approved FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 8. match_requests
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

    // 9. posts
    await db.query(`
      CREATE TABLE IF NOT EXISTS posts (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        content    TEXT NOT NULL,
        image_url  VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 10. post_likes
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

    // 11. post_comments
    await db.query(`
      CREATE TABLE IF NOT EXISTS post_comments (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        post_id    INT NOT NULL,
        user_id    INT NOT NULL,
        content    TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_pc_post (post_id),
        INDEX idx_pc_user (user_id),
        CONSTRAINT fk_pc_post FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        CONSTRAINT fk_pc_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 12. post_shares
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

    // 13. events
    await db.query(`
      CREATE TABLE IF NOT EXISTS events (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        title                VARCHAR(255) NOT NULL,
        description          TEXT,
        date_time            DATETIME NOT NULL,
        location             VARCHAR(255) NOT NULL,
        capacity             INT NOT NULL DEFAULT 0,
        creator_id           INT NOT NULL,
        status               VARCHAR(50) DEFAULT 'active',
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        host_name            VARCHAR(150) NULL,
        application_deadline DATETIME NULL,
        entry_fee            DECIMAL(10,2) DEFAULT 0,
        CONSTRAINT fk_events_creator FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 14. event_participants
    await db.query(`
      CREATE TABLE IF NOT EXISTS event_participants (
        event_id  INT NOT NULL,
        user_id   INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (event_id, user_id),
        CONSTRAINT fk_ep_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        CONSTRAINT fk_ep_user  FOREIGN KEY (user_id)  REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    // 15. chat_messages
    await db.query(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        sender_id   INT NOT NULL,
        receiver_id INT NOT NULL,
        message     TEXT NOT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_chat_sender   FOREIGN KEY (sender_id)   REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_chat_receiver FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },

  down: async (db) => {
    // Reverse dependency order. NOTE: on an existing production DB these tables
    // pre-existed; rolling back this migration drops them (same convention as
    // the other schema migrations).
    await db.query("DROP TABLE IF EXISTS chat_messages");
    await db.query("DROP TABLE IF EXISTS event_participants");
    await db.query("DROP TABLE IF EXISTS events");
    await db.query("DROP TABLE IF EXISTS post_shares");
    await db.query("DROP TABLE IF EXISTS post_comments");
    await db.query("DROP TABLE IF EXISTS post_likes");
    await db.query("DROP TABLE IF EXISTS posts");
    await db.query("DROP TABLE IF EXISTS match_requests");
    await db.query("DROP TABLE IF EXISTS withdraw_requests");
    await db.query("DROP TABLE IF EXISTS deposit_requests");
    await db.query("DROP TABLE IF EXISTS transactions");
    await db.query("DROP TABLE IF EXISTS package_features");
    await db.query("DROP TABLE IF EXISTS features");
    await db.query("DROP TABLE IF EXISTS packages");
  },
};