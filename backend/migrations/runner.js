const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const db_config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'bluedise'
};

class MigrationRunner {
    async connect() {
        this.connection = await mysql.createConnection(db_config);
    }

    async disconnect() {
        if (this.connection) await this.connection.end();
    }

    async createMigrationsTable() {
        await this.connection.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                filename VARCHAR(255) NOT NULL UNIQUE,
                applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
    }

    async getAppliedMigrations() {
        const [rows] = await this.connection.query(
            'SELECT filename FROM migrations ORDER BY applied_at'
        );
        return rows.map(row => row.filename);
    }

    async getMigrationFiles() {
        const dir = __dirname;
        return fs.readdirSync(dir)
            .filter(f => f.endsWith('.js') && f !== 'runner.js' && f !== 'cli.js')
            .sort();
    }

    async runMigration(filename, direction = 'up') {
        try {
            const migration = require(`./${filename}`);
            
            console.log(`\n📝 Running ${filename} (${direction})...`);
            
            if (direction === 'up') {
                await migration.up(this.connection);
                await this.connection.query(
                    'INSERT INTO migrations (filename) VALUES (?)',
                    [filename]
                );
                console.log(`✅ ${filename} applied successfully`);
            } else if (direction === 'down') {
                await migration.down(this.connection);
                await this.connection.query(
                    'DELETE FROM migrations WHERE filename = ?',
                    [filename]
                );
                console.log(`⏮️  ${filename} rolled back successfully`);
            }
        } catch (error) {
            console.error(`\n❌ Error in ${filename}:`, error.message);
            throw error;
        }
    }

    async migrate() {
        try {
            await this.connect();
            await this.createMigrationsTable();

            const appliedMigrations = await this.getAppliedMigrations();
            const allMigrations = await this.getMigrationFiles();

            const pendingMigrations = allMigrations.filter(
                m => !appliedMigrations.includes(m)
            );

            if (pendingMigrations.length === 0) {
                console.log('\n✅ No pending migrations\n');
                return;
            }

            console.log(`\n🔄 Found ${pendingMigrations.length} pending migration(s)\n`);

            for (const filename of pendingMigrations) {
                await this.runMigration(filename, 'up');
            }

            console.log('\n🎉 All migrations completed successfully!\n');
        } catch (error) {
            console.error('\n💥 Migration failed:', error.message);
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }

    async rollback(steps = 1) {
        try {
            await this.connect();
            await this.createMigrationsTable();

            const appliedMigrations = await this.getAppliedMigrations();
            const toRollback = appliedMigrations.slice(-steps);

            if (toRollback.length === 0) {
                console.log('\n⚠️  No migrations to rollback\n');
                return;
            }

            console.log(`\n⏮️  Rolling back ${toRollback.length} migration(s)\n`);

            for (const filename of toRollback.reverse()) {
                await this.runMigration(filename, 'down');
            }

            console.log('\n✅ Rollback completed!\n');
        } catch (error) {
            console.error('\n💥 Rollback failed:', error.message);
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }

    async status() {
        try {
            await this.connect();
            await this.createMigrationsTable();

            const appliedMigrations = await this.getAppliedMigrations();
            const allMigrations = await this.getMigrationFiles();
            const pendingMigrations = allMigrations.filter(
                m => !appliedMigrations.includes(m)
            );

            console.log('\n📊 Migration Status\n');
            
            if (appliedMigrations.length > 0) {
                console.log('✅ Applied Migrations:');
                appliedMigrations.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
            }

            if (pendingMigrations.length > 0) {
                console.log('\n⏳ Pending Migrations:');
                pendingMigrations.forEach((m, i) => console.log(`   ${i + 1}. ${m}`));
            } else {
                console.log('\n✨ All migrations applied!');
            }
            console.log('');
        } catch (error) {
            console.error('Error:', error.message);
            process.exit(1);
        } finally {
            await this.disconnect();
        }
    }
}

module.exports = MigrationRunner;