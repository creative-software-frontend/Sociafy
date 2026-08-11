const MigrationRunner = require('./runner');

const command = process.argv[2];
const arg = process.argv[3];

const runner = new MigrationRunner();

(async () => {
    if (command === 'up' || command === 'migrate') {
        await runner.migrate();
    } else if (command === 'down' || command === 'rollback') {
        const steps = arg ? parseInt(arg) : 1;
        await runner.rollback(steps);
    } else if (command === 'status') {
        await runner.status();
    } else {
        console.log(`
╔═════════════════════════════════════════════════════╗
║   Sociafy Database Migration CLI                    ║
╚═════════════════════════════════════════════════════╝

Usage:
  node migrations/cli.js <command> [options]

Commands:
  up, migrate        Run all pending migrations
  down, rollback     Rollback last migration (or N migrations)
  status             Show migration status

Examples:
  node migrations/cli.js up                 # Run all pending
  node migrations/cli.js down               # Rollback last 1
  node migrations/cli.js down 3             # Rollback last 3
  node migrations/cli.js status             # Show status
        `);
        process.exit(0);
    }
})().catch(err => {
    console.error(err);
    process.exit(1);
});