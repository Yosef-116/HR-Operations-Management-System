const bcrypt = require('bcryptjs'); 
const { Client } = require('pg'); 
const client = new Client({ connectionString: 'postgresql://postgres.lxvnqlgtemtubtvycvmc:Graceddb%23116%24@aws-1-eu-central-1.pooler.supabase.com:6543/postgres' }); 
async function reset() { 
  await client.connect(); 
  const hash = await bcrypt.hash('Password123456!', 10); 
  await client.query('UPDATE hr_auth.user_accounts SET password_hash = $1 WHERE username = $2', [hash, 'admin']); 
  console.log('Password reset'); 
  await client.end(); 
} 
reset().catch(console.error);
