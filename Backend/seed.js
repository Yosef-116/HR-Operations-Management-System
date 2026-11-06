const { Client } = require('pg');
const bcrypt = require('bcryptjs');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('ERROR: DATABASE_URL environment variable is required.\nSet it in your .env file or pass it directly: DATABASE_URL=... node seed.js');
  process.exit(1);
}

const client = new Client({ connectionString });

async function seed() {
  await client.connect();

  // Create Employee
  const res = await client.query(
    'INSERT INTO org.employee (f_name, l_name, email, employment_status, hire_date) VALUES ($1, $2, $3, $4, CURRENT_DATE) ON CONFLICT (email) DO UPDATE SET f_name=EXCLUDED.f_name RETURNING employee_id',
    ['Admin', 'User', 'admin', 'Active']
  );
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

  // Seed Leave Types
  const defaultLeaveTypes = [
    { name: 'Annual Leave', is_paid: true },
    { name: 'Sick Leave', is_paid: true },
    { name: 'Maternity Leave', is_paid: true },
    { name: 'Paternity Leave', is_paid: true },
    { name: 'Compassionate Leave', is_paid: true },
    { name: 'Unpaid Leave', is_paid: false }
  ];

  for (const lt of defaultLeaveTypes) {
    await client.query(
      'INSERT INTO payroll.leave_types (name, is_paid) SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM payroll.leave_types WHERE lower(name) = lower($1))',
      [lt.name, lt.is_paid]
    );
  }
  console.log('Default leave types verified/seeded.');

  // Seed default entitlements for existing job titles
  const jobs = await client.query('SELECT job_id FROM recruitment.job_titles');
  const types = await client.query('SELECT type_id, name FROM payroll.leave_types');
  for (const job of jobs.rows) {
    for (const type of types.rows) {
      const defaultDays = type.name.toLowerCase().includes('sick') ? 14 : (type.name.toLowerCase().includes('annual') ? 20 : 10);
      await client.query(
        `INSERT INTO payroll.leave_entitlements (type_id, job_id, days_per_year, accrual_rate_monthly, can_carry_over)
         VALUES ($1, $2, $3, 1.5, true)
         ON CONFLICT (type_id, job_id) DO NOTHING`,
        [type.type_id, job.job_id, defaultDays]
      );
    }
  }
  console.log('Leave entitlements verified/seeded.');

  // Seed standard Ethiopian Income Tax Brackets if none exist
  const existingTax = await client.query('SELECT count(*) FROM payroll.tax_brackets_eth');
  if (Number(existingTax.rows[0].count) === 0) {
    const taxBrackets = [
      { min: 0, max: 600, rate: 0.00, fee: 0.00 },
      { min: 601, max: 1650, rate: 0.10, fee: 60.00 },
      { min: 1651, max: 3200, rate: 0.15, fee: 142.50 },
      { min: 3201, max: 5250, rate: 0.20, fee: 302.50 },
      { min: 5251, max: 7800, rate: 0.25, fee: 565.00 },
      { min: 7801, max: 10900, rate: 0.30, fee: 955.00 },
      { min: 10901, max: null, rate: 0.35, fee: 1500.00 }
    ];
    for (const tb of taxBrackets) {
      await client.query(
        'INSERT INTO payroll.tax_brackets_eth (min_income, max_income, tax_rate, deductible_fee) VALUES ($1, $2, $3, $4)',
        [tb.min, tb.max, tb.rate, tb.fee]
      );
    }
    console.log('Standard Ethiopian tax brackets seeded.');
  }

  // Seed standard salary matrix tiers if none exist
  const existingMatrix = await client.query('SELECT count(*) FROM payroll.salary_matrix');
  if (Number(existingMatrix.rows[0].count) === 0) {
    const salaryLevels = [
      { level: 'L1', step: 1, base: 12000.00 },
      { level: 'L2', step: 1, base: 22000.00 },
      { level: 'L3', step: 1, base: 38000.00 },
      { level: 'L4', step: 1, base: 60000.00 },
      { level: 'L5', step: 1, base: 95000.00 }
    ];
    for (const sm of salaryLevels) {
      await client.query(
        'INSERT INTO payroll.salary_matrix (level, step, base_salary) VALUES ($1, $2, $3)',
        [sm.level, sm.step, sm.base]
      );
    }
    console.log('Default salary matrix tiers seeded.');
  }

  // Ensure active employees have an active salary contract
  const defaultMatrix = await client.query('SELECT matrix_id FROM payroll.salary_matrix ORDER BY matrix_id ASC LIMIT 1');
  if (defaultMatrix.rows.length > 0) {
    const matrixId = defaultMatrix.rows[0].matrix_id;
    const uncontractedEmps = await client.query(
      `SELECT e.employee_id
       FROM org.employee e
       LEFT JOIN payroll.salary_contracts sc ON sc.employee_id = e.employee_id AND sc.is_active = true
       WHERE sc.contract_id IS NULL AND e.employment_status = 'Active'`
    );
    for (const row of uncontractedEmps.rows) {
      await client.query(
        `INSERT INTO payroll.salary_contracts (employee_id, matrix_id, contract_type, start_date, is_active)
         VALUES ($1, $2, 'Permanent', CURRENT_DATE, true)`,
        [row.employee_id, matrixId]
      );
    }
    if (uncontractedEmps.rows.length > 0) {
      console.log(`Seeded default salary contracts for ${uncontractedEmps.rows.length} employees.`);
    }
  }

  await client.end();
}
seed().catch(console.error);
