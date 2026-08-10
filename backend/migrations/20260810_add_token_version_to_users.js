/**
 * Add token_version to users — server-side admin session/token invalidation.
 *
 * - token_version starts at 0 for every existing row.
 * - Newly issued admin JWTs embed the current token_version.
 * - adminAuthMiddleware re-reads token_version from the DB on every request and
 *   rejects any JWT whose embedded version no longer matches (stale session).
 * - Changing the admin password increments token_version, invalidating every
 *   previously issued admin JWT for that account.
 *
 * Normal users are unaffected: their tokens carry no token_version claim and
 * the normal-user auth flow never checks it.
 */

module.exports = {
  up: async (db) => {
    await db.query(`
      ALTER TABLE users
      ADD COLUMN token_version INT NOT NULL DEFAULT 0;
    `);
  },

  down: async (db) => {
    await db.query(`
      ALTER TABLE users
      DROP COLUMN token_version;
    `);
  }
};
