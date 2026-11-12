require('dotenv').config();

const app = require('./app');
const config = require('./config/env');

app.listen(config.port, () => {
  console.log(`Make My Marriage server listening on port ${config.port} (${config.nodeEnv}).`);
});
