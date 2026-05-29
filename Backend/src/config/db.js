const { Pool } = require('pg');
const env = require('./env');

const baseConfig = {
  ssl: env.dbSsl,
  max: 15,
  idleTimeoutMillis: 30000
};

const getPoolConfig = () => {
  if (env.databaseUrl) {
    return {
      connectionString: env.databaseUrl,
      ...baseConfig
    };
  }

  return {
    host: env.dbHost,
    port: env.dbPort,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    ...baseConfig
  };
};

const pool = new Pool(getPoolConfig());

const getSafeConnectionInfo = () => {
  if (!env.databaseUrl) {
    return {
      usingConnectionString: false,
      host: env.dbHost,
      port: env.dbPort,
      database: env.dbName,
      user: env.dbUser,
      hasPassword: Boolean(env.dbPassword)
    };
  }

  const url = new URL(env.databaseUrl);
  return {
    usingConnectionString: true,
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ''),
    user: decodeURIComponent(url.username || ''),
    hasPassword: Boolean(url.password)
  };
};

const assertDbConfig = () => {
  if (!env.databaseUrl) return;

  const url = new URL(env.databaseUrl);
  if (url.username && !url.password) {
    throw new Error(
      'DATABASE_URL includes a username but no password. Add a password, use DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD variables, or configure PostgreSQL trust auth for local development.'
    );
  }
};

assertDbConfig();

const testConnection = async () => {
  const result = await pool.query('SELECT current_database() AS database, current_user AS user_name, version() AS version');
  return result.rows[0];
};

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL client error', error);
});

const query = (text, params = []) => pool.query(text, params);

const withTransaction = async (work) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  query,
  withTransaction,
  testConnection,
  getSafeConnectionInfo
};
