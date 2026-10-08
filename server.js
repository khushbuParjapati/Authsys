const config = require('./config');
const connectDB = require('./config/db');
const mongoose = require('mongoose');
const app = require('./app');

(async () => {
  await connectDB();
  const server = app.listen(config.port, '0.0.0.0', () => console.log(`Server running at ${config.appUrl} (port ${config.port})`));

  // Render sends SIGTERM on every deploy/restart: finish requests, close DB, then exit.
  const shutdown = () => {
    server.close(async () => {
      await mongoose.connection.close().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
})();
