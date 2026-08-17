/**
 * Gift Asset Library
 *
 * Adds a persistent, database-backed gift asset library so admins manage
 * reusable GIF/PNG/JPG/WebP assets (stored through the project's storage
 * provider — Supabase S3 in production, local filesystem in dev) instead of
 * hardcoding/local paths that break after a free-hosting redeploy.
 *
 * Existing gifts keep working: `gifts.asset_id` is NULL for them and they
 * continue rendering their existing `image`/`icon` fallback.
 */

module.exports = {
    up: async (db) => {
        await db.query(`
            CREATE TABLE IF NOT EXISTS gift_assets (
                id          INT AUTO_INCREMENT PRIMARY KEY,
                name        VARCHAR(100) NOT NULL,
                asset_type  VARCHAR(10)  NOT NULL DEFAULT 'png',
                url         VARCHAR(2048) NOT NULL,
                storage_key VARCHAR(255) NULL,
                is_active   TINYINT(1)   NOT NULL DEFAULT 1,
                created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_ga_active (is_active)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);

        const [cols] = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gifts'`
        );
        const names = cols.map((c) => c.COLUMN_NAME.toLowerCase());
        if (!names.includes('asset_id')) {
            await db.query(`ALTER TABLE gifts ADD COLUMN asset_id INT NULL`);
        }

        try {
            const [fk] = await db.query(
                `SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gifts'
                 AND CONSTRAINT_NAME = 'fk_gifts_asset'`
            );
            if (!fk.length) {
                await db.query(
                    `ALTER TABLE gifts ADD CONSTRAINT fk_gifts_asset
                     FOREIGN KEY (asset_id) REFERENCES gift_assets(id) ON DELETE SET NULL`
                );
            }
        } catch (e) { /* FK already exists or cannot be added — non-fatal */ }
    },

    down: async (db) => {
        try { await db.query(`ALTER TABLE gifts DROP FOREIGN KEY fk_gifts_asset`); } catch (e) { /* ignore */ }
        const [cols] = await db.query(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'gifts'`
        );
        const names = cols.map((c) => c.COLUMN_NAME.toLowerCase());
        if (names.includes('asset_id')) {
            await db.query(`ALTER TABLE gifts DROP COLUMN asset_id`);
        }
        await db.query(`DROP TABLE IF EXISTS gift_assets`);
    },
};