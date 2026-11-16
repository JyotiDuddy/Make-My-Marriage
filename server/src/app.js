const express = require('express');
const helmet = require('helmet');
const cors = require('./middleware/cors');
const sessionMiddleware = require('./config/session').sessionMiddleware;
const config = require('./config/env');
const { createV1Router } = require('./routes/v1');
const notFound = require('./middleware/not-found');
const errorHandler = require('./middleware/error-handler');

function createApp(options = {}) {
  const app = express();

  app.set('trust proxy', config.trustProxy);
  app.use(helmet());
  app.use(cors);
  app.use(express.json());
  app.use(sessionMiddleware);

  app.use('/api/v1', createV1Router(options));
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

const app = createApp();
module.exports = app;
module.exports.createApp = createApp;
