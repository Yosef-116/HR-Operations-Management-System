const fs = require('fs');
const { pool, testConnection, getSafeConnectionInfo } = require('../src/config/db');
const { schemaSqlPath } = require('../src/config/resources');
const authService = require('../src/services/authService');

const main = async () => {
  console.log('Using database config:');
  console.log(JSON.stringify(getSafeConnectionInfo(), null, 2));
  const connection = await testConnection();
  console.log(`Connected to ${connection.database} as ${connection.user_name}`);

  const existingSchema = await pool.query("SELECT to_regclass('org.employee') AS employee_table");
  if (existingSchema.rows[0].employee_table) {
    console.log('Schema already exists; skipping table creation.');
  } else {
    const sql = fs.readFileSync(schemaSqlPath, 'utf8');
    await pool.query(sql);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await authService.seedCoreRoles(client);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  console.log(`Migration completed from ${schemaSqlPath}`);
};

main()
  .catch((error) => {
    if (error.code === '3D000') {
      console.error(`${error.message}\nRun npm run db:ensure to create the local database, then run npm run migrate again.`);
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  })
  .finally(() => pool.end());
