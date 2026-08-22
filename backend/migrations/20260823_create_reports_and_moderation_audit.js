/**
 * Reporting and moderation foundation.
 *
 * The generated pending key prevents concurrent duplicate Pending reports while
 * allowing a new report after an earlier report has been reviewed or dismissed.
 */
module.exports = {
  up: async (db) => {
    await db.query(`
      CREATE TABLE IF NOT EXISTS user_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        reported_user_id INT NOT NULL,
        reason_id INT NOT NULL,
        description TEXT NULL,
        status ENUM('Pending', 'Reviewed', 'Dismissed') NOT NULL DEFAULT 'Pending',
        admin_note TEXT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        pending_key VARCHAR(100) GENERATED ALWAYS AS
          (IF(status = 'Pending', CONCAT(reporter_id, ':', reported_user_id, ':', reason_id), NULL)) STORED,
        UNIQUE KEY uq_user_reports_pending (pending_key),
        INDEX idx_user_reports_status (status),
        INDEX idx_user_reports_reported (reported_user_id),
        INDEX idx_user_reports_reporter (reporter_id),
        INDEX idx_user_reports_reason (reason_id),
        INDEX idx_user_reports_created (created_at),
        CONSTRAINT fk_user_reports_reporter FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_reports_reported FOREIGN KEY (reported_user_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_user_reports_reason FOREIGN KEY (reason_id) REFERENCES report_reasons(id) ON DELETE RESTRICT,
        CONSTRAINT fk_user_reports_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await db.query(`
      CREATE TABLE IF NOT EXISTS moderation_audit_log (
        id INT AUTO_INCREMENT PRIMARY KEY,
        admin_id INT NOT NULL,
        action VARCHAR(50) NOT NULL,
        target_user_id INT NULL,
        report_id INT NULL,
        note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_moderation_audit_target (target_user_id),
        INDEX idx_moderation_audit_report (report_id),
        INDEX idx_moderation_audit_created (created_at),
        CONSTRAINT fk_moderation_audit_admin FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE CASCADE,
        CONSTRAINT fk_moderation_audit_target FOREIGN KEY (target_user_id) REFERENCES users(id) ON DELETE SET NULL,
        CONSTRAINT fk_moderation_audit_report FOREIGN KEY (report_id) REFERENCES user_reports(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
  },

  down: async (db) => {
    await db.query('DROP TABLE IF EXISTS moderation_audit_log');
    await db.query('DROP TABLE IF EXISTS user_reports');
  },
};