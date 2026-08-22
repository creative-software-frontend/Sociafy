/**
 * Create dynamically configurable report reasons.
 */
module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS report_reasons (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL UNIQUE,
        description VARCHAR(255) NULL,
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const defaultReasons = [
      ["Inappropriate Content", "User posted inappropriate or offensive content"],
      ["Harassment", "User is harassing or threatening others"],
      ["Spam", "User is sending spam or unwanted messages"],
      ["Fake Profile", "User appears to be using a fake identity"],
      ["Scam/Fraud", "User is attempting to scam or defraud others"],
      ["Violence/Threats", "User is promoting violence or making threats"],
      ["Sexual Content", "User is sharing inappropriate sexual content"],
      ["Hate Speech", "User is posting hate speech or discriminatory content"],
      ["Privacy Violation", "User is violating privacy or sharing personal info"],
      ["Other", "Other reason not listed above"],
    ];
    await db.query(
      "INSERT IGNORE INTO report_reasons (name, description) VALUES ?",
      [defaultReasons]
    );
  },

  down: async (db) => {
    await db.query("DROP TABLE IF EXISTS report_reasons");
  },
};
