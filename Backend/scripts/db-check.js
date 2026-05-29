const { pool, testConnection, getSafeConnectionInfo } = require('../src/config/db');

const main = async () => {
  const info = getSafeConnectionInfo();
  console.log('Database config:');
  console.log(JSON.stringify(info, null, 2));

  const result = await testConnection();
  console.log(`Connected to ${result.database} as ${result.user_name}`);
};

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
