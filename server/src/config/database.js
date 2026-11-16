const mongoose = require('mongoose');
const config = require('./env');

async function connectDB() {
  await mongoose.connect(config.mongoUri, { dbName: config.mongoDbName });
  return mongoose.connection;
}

module.exports = connectDB;
