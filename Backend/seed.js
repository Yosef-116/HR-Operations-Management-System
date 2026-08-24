const { Client } = require('pg'); 
const bcrypt = require('bcryptjs');
const client = new Client({ connectionString: 'postgresql://postgres.lxvnqlgtemtubtvycvmc:Graceddb%23116%24@aws-1-eu-central-1.pooler.supabase.com:6543/postgres' }); 
async function seed() { 
  await client.connect(); 
  
  // Create Employee
  const res = await client.query('INSERT INTO org.employee (f_name, l_name, email, employment_status, hire_date) VALUES ($1, $2, $3, $4, CURRENT_DATE) ON CONFLICT (email) DO UPDATE SET f_name=EXCLUDED.f_name RETURNING employee_id', ['Admin', 'User', 'admin@example.com', 'Active']); 
  console.log('Employee seeded:', res.rows); 
  
  // Create User Account
  const employeeId = res.rows[0].employee_id;
  const passwordHash = await bcrypt.hash('admin123', 10);
  const authRes = await client.query(
    'INSERT INTO hr_auth.user_accounts (employee_id, username, password_hash, is_active, is_deleted) VALUES ($1, $2, $3, true, false) ON CONFLICT (username) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING user_id',
    [employeeId, 'admin', passwordHash]
  );
  console.log('User account seeded:', authRes.rows);
  const userId = authRes.rows[0].user_id;

  // Create Role and assign to user
  await client.query('INSERT INTO hr_auth.roles (role_name) VALUES ($1) ON CONFLICT (role_name) DO NOTHING', ['Admin']);
  const roleRes = await client.query('SELECT role_id FROM hr_auth.roles WHERE role_name = $1', ['Admin']);
  if (roleRes.rows.length > 0) {
    const roleId = roleRes.rows[0].role_id;
    await client.query('INSERT INTO hr_auth.user_roles (user_id, role_id) VALUES ($1, $2) ON CONFLICT (user_id, role_id) DO NOTHING', [userId, roleId]);
    console.log('Admin role assigned.');
  }

  await client.end(); 
} 
seed().catch(console.error);
