const path = require('path');
require('dotenv').config();

const bool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

const list = (value) => {
  if (!value || value === '*') return '*';
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const csvList = (value) => {
  if (!value) return [];
  return value.split(',').map((item) => item.trim()).filter(Boolean);
};

const number = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: number(process.env.PORT, 5000),
  databaseUrl: process.env.DATABASE_URL,
  dbHost: process.env.DB_HOST || process.env.PGHOST || '127.0.0.1',
  dbPort: number(process.env.DB_PORT || process.env.PGPORT, 5432),
  dbName: process.env.DB_NAME || process.env.PGDATABASE || 'hr_operations',
  dbUser: process.env.DB_USER || process.env.PGUSER || 'postgres',
  dbPassword: process.env.DB_PASSWORD ?? process.env.PGPASSWORD,
  dbSsl: bool(process.env.DB_SSL) ? { rejectUnauthorized: false } : false,
  jwtSecret: process.env.JWT_SECRET || 'development-only-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  bcryptRounds: number(process.env.BCRYPT_ROUNDS, 10),
  googleClientIds: csvList(process.env.GOOGLE_CLIENT_IDS || process.env.GOOGLE_CLIENT_ID || ''),
  googleAutoCreateAccounts: process.env.GOOGLE_AUTO_CREATE_ACCOUNTS === undefined ? true : bool(process.env.GOOGLE_AUTO_CREATE_ACCOUNTS, true),
  corsOrigin: list(process.env.CORS_ORIGIN || '*'),
  authRequired: process.env.AUTH_REQUIRED === undefined ? true : bool(process.env.AUTH_REQUIRED, true),
  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads')
};

if (config.nodeEnv === 'production') {
  if (config.jwtSecret === 'development-only-secret-change-me' || config.jwtSecret === 'replace-this-with-a-long-random-secret') {
    throw new Error('JWT_SECRET must be set to a strong production secret.');
  }

  if (!config.authRequired) {
    throw new Error('AUTH_REQUIRED must not be false in production.');
  }
}

module.exports = config;
