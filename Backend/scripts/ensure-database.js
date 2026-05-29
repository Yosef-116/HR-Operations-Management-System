const { Pool } = require('pg');
const env = require('../src/config/env');

const identifierPattern = /^[a-z_][a-z0-9_]*$/i;

const quoteIdent = (identifier) => {
  if (!identifierPattern.test(identifier)) {
    throw new Error(`Unsafe database name: ${identifier}`);
  }
  return `"${identifier}"`;
};

const getTarget = () => {
  if (!env.databaseUrl) {
    return {
      host: env.dbHost,
      port: env.dbPort,
      database: env.dbName,
      user: env.dbUser,
      password: env.dbPassword,
      ssl: env.dbSsl
    };
  }

  const url = new URL(env.databaseUrl);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ''),
    user: decodeURIComponent(url.username || ''),
    password: decodeURIComponent(url.password || ''),
    ssl: env.dbSsl
  };
};

const main = async () => {
  const target = getTarget();
  if (!target.database) {
    throw new Error('Target database name is missing.');
  }

  const adminPool = new Pool({
    host: target.host,
    port: target.port,
    database: 'postgres',
    user: target.user,
    password: target.password,
    ssl: target.ssl
  });

  try {
    const exists = await adminPool.query('SELECT 1 FROM pg_database WHERE datname = $1', [target.database]);
    if (exists.rowCount) {
      console.log(`Database "${target.database}" already exists.`);
      return;
    }

    await adminPool.query(`CREATE DATABASE ${quoteIdent(target.database)}`);
    console.log(`Database "${target.database}" created.`);
  } finally {
    await adminPool.end();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
