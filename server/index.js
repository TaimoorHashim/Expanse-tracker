const app = require('./app');
const config = require('./config');
const pool = require('./db');

const server = app.listen(config.port, () => {
  console.log(`===============================================`);
  console.log(` Family Expense & Debt Tracker Server Running`);
  console.log(` Environment: ${config.env}`);
  console.log(` URL:         http://localhost:${config.port}`);
  console.log(`===============================================`);
});

// Graceful shutdown
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(async () => {
    try {
      await pool.end();
      console.log('Database pool closed. Exiting process.');
      process.exit(0);
    } catch (err) {
      console.error('Error closing database pool:', err);
      process.exit(1);
    }
  });
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

module.exports = server;
