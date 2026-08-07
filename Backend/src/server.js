const app = require('./app');
const env = require('./config/env');
const { pool, testConnection, getSafeConnectionInfo } = require('./config/db');
const { seedCoreRoles } = require('./services/authService');

const startServer = async () => {
  try {
    const info = getSafeConnectionInfo();
    console.log(`Connecting to PostgreSQL ${info.database}@${info.host}:${info.port} as ${info.user}`);

    const connection = await testConnection();
    console.log(`Database connected: ${connection.database} as ${connection.user_name}`);
    await pool.connect().then(async (client) => {
      try {
        await client.query('BEGIN');
        await seedCoreRoles(client);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    });
    console.log('Core roles and permissions synchronised');

    const server = app.listen(env.port, () => {
      console.log(`HR Operations Management API listening on port ${env.port}`);
    });

    const shutdown = async (signal) => {
      console.log(`${signal} received. Closing API and database pool...`);
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
  } catch (error) {
    const info = getSafeConnectionInfo();
    console.error('Database connection failed. Server was not started.');
    console.error(`Tried PostgreSQL ${info.database}@${info.host}:${info.port} as ${info.user}`);
    console.error(error.message);
    console.error('Check .env, make sure PostgreSQL is running, then run npm run db:check.');
    await pool.end().catch(() => {});
    process.exit(1);
  }
};

startServer();
