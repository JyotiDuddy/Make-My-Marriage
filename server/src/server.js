require('dotenv').config();

const app = require('./app');
const config = require('./config/env');
const connectDB = require('./config/database');

async function startServer() {
  await connectDB();

  return new Promise((resolve, reject) => {
    const server = app.listen(config.port, () => {
      server.removeListener('error', reject);
      console.log(`Make My Marriage server listening on port ${config.port} (${config.nodeEnv}).`);
      resolve(server);
    });
    server.once('error', reject);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    const safeCode = error.code || error.name || 'UNKNOWN_ERROR';
    console.error(`Server startup failed (${safeCode}).`);
    process.exitCode = 1;
  });
}

module.exports = startServer;
