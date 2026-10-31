const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'family_tracker'
  },
  session: {
    secret: process.env.SESSION_SECRET || 'dev-secret-family-tracker-change-me',
    days: parseInt(process.env.SESSION_DAYS, 10) || 7
  },
  registrationOpen: process.env.REGISTRATION_OPEN !== 'false',
  appOrigin: process.env.APP_ORIGIN || 'http://localhost:3000'
};

module.exports = config;
