module.exports = {
    up: async (db) => {
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
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                
                INDEX idx_email (email),
                INDEX idx_role (role),
                INDEX idx_is_active (is_active),
                INDEX idx_privacy_accepted (privacy_accepted),
                INDEX idx_created_at (created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        `);
    },

    down: async (db) => {
        await db.query('DROP TABLE IF EXISTS users');
    }
};